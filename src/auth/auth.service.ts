import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../database/entities/users.entity';
import { PasswordResetCode } from '../database/entities/password-reset-code.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { VerifyPasswordChangeDto } from './dto/verify-password-change.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private resend: Resend;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(PasswordResetCode)
    private readonly passwordResetCodeRepository: Repository<PasswordResetCode>,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async register(registerDto: RegisterDto): Promise<TokenResponseDto> {
    // Verificar si el usuario ya existe
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Usar el rol proporcionado o 'customer' por defecto
    const role = registerDto.role || UserRole.CUSTOMER;

    // Hashear la contraseña
    const passwordHash = await this.hashPassword(registerDto.password);

    // Crear el usuario
    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash,
      name: registerDto.name || undefined,
      phone: registerDto.phone || undefined,
      countryCode: registerDto.countryCode || undefined,
      preferredCurrency: registerDto.preferredCurrency || undefined,
      role,
    });

    // Generar tokens
    const tokens = await this.generateTokens(user);

    // Guardar el refresh token hasheado
    const refreshTokenHash = await this.hashRefreshToken(tokens.refreshToken);
    await this.usersService.updateRefreshToken(user.id, refreshTokenHash);

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    // Buscar usuario por email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña
    const isPasswordValid = await this.validatePassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que el usuario esté activo
    if (user.status !== 'active') {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Actualizar último login
    await this.usersService.update(user.id, {
      lastLoginAt: new Date(),
    });

    // Generar tokens
    const tokens = await this.generateTokens(user);

    // Guardar el refresh token hasheado
    const refreshTokenHash = await this.hashRefreshToken(tokens.refreshToken);
    await this.usersService.updateRefreshToken(user.id, refreshTokenHash);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    // Invalidar el refresh token eliminándolo de la base de datos
    await this.usersService.updateRefreshToken(userId, null);
  }

  async refreshTokens(
    user: User,
    refreshToken: string,
  ): Promise<TokenResponseDto> {
    // Verificar que el usuario tenga un refresh token guardado
    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token no válido');
    }

    // Verificar que el refresh token coincida
    const isTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isTokenValid) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Generar nuevos tokens
    const tokens = await this.generateTokens(user);

    // Actualizar el refresh token hasheado en la base de datos
    const refreshTokenHash = await this.hashRefreshToken(tokens.refreshToken);
    await this.usersService.updateRefreshToken(user.id, refreshTokenHash);

    return tokens;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.validatePassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  private async generateTokens(user: User): Promise<TokenResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtExpiration = this.configService.get<string>('JWT_EXPIRATION', '15m');
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está configurado en las variables de entorno');
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: jwtExpiration as any,
    });

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: 1, // Puedes incrementar esto para invalidar todos los tokens
    };

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET no está configurado en las variables de entorno');
    }

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiration as any,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  private async hashRefreshToken(token: string): Promise<string> {
    // Hashear el refresh token igual que una contraseña
    return bcrypt.hash(token, this.SALT_ROUNDS);
  }

  private async validatePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Genera un código alfanumérico de 6 caracteres
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Solicita cambio de contraseña por email (público, para recuperar contraseña)
   */
  async requestPasswordChangeByEmail(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Por seguridad, no revelamos si el email existe o no
      return { message: 'Si el email existe, se ha enviado un código de verificación' };
    }

    return this.requestPasswordChange(user);
  }

  /**
   * Solicita cambio de contraseña: genera código y envía email
   */
  async requestPasswordChange(user: User): Promise<{ message: string }> {
    // Invalidar códigos anteriores no usados del usuario
    await this.passwordResetCodeRepository.update(
      {
        user: { id: user.id },
        isUsed: false,
      },
      {
        isUsed: true,
      },
    );

    // Generar nuevo código
    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Expira en 15 minutos

    // Guardar código en base de datos
    const resetCode = this.passwordResetCodeRepository.create({
      user,
      code,
      expiresAt,
      isUsed: false,
    });
    await this.passwordResetCodeRepository.save(resetCode);

    // Enviar email con el código
    if (this.resend) {
      const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
      const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

      try {
        await this.resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: user.email,
          subject: 'Código de verificación para cambio de contraseña',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #00b2de;">Cambio de Contraseña</h2>
              <p>Hola ${user.name || user.email},</p>
              <p>Has solicitado cambiar tu contraseña. Utiliza el siguiente código de verificación:</p>
              <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                <h1 style="color: #00b2de; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h1>
              </div>
              <p>Este código expirará en 15 minutos.</p>
              <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
              <p>Saludos,<br>Equipo Carvajal Fit</p>
            </div>
          `,
        });
      } catch (error) {
        console.error('Error al enviar email:', error);
        // No lanzar error, el código ya está guardado
      }
    }

    return {
      message: 'Código de verificación enviado a tu correo electrónico',
    };
  }

  /**
   * Verifica el código y cambia la contraseña por email (público, para recuperar contraseña)
   */
  async verifyAndChangePasswordByEmail(
    verifyDto: VerifyPasswordChangeDto,
  ): Promise<{ message: string }> {
    if (!verifyDto.email) {
      throw new BadRequestException('El email es requerido');
    }

    const user = await this.usersService.findByEmail(verifyDto.email);
    if (!user) {
      throw new BadRequestException('Email no encontrado');
    }

    return this.verifyAndChangePassword(user, verifyDto);
  }

  /**
   * Verifica el código y cambia la contraseña
   */
  async verifyAndChangePassword(
    user: User,
    verifyDto: VerifyPasswordChangeDto,
  ): Promise<{ message: string }> {
    // Buscar código válido
    const resetCode = await this.passwordResetCodeRepository.findOne({
      where: {
        user: { id: user.id },
        code: verifyDto.code,
        isUsed: false,
      },
      relations: ['user'],
    });

    if (!resetCode) {
      throw new BadRequestException('Código inválido o ya utilizado');
    }

    // Verificar que no haya expirado
    if (new Date() > resetCode.expiresAt) {
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }

    // Marcar código como usado
    resetCode.isUsed = true;
    await this.passwordResetCodeRepository.save(resetCode);

    // Cambiar contraseña
    const newPasswordHash = await this.hashPassword(verifyDto.newPassword);
    await this.usersService.update(user.id, {
      passwordHash: newPasswordHash,
    });

    return {
      message: 'Contraseña cambiada exitosamente',
    };
  }
}

