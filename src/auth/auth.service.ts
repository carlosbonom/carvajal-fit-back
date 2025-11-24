import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../database/entities/users.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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
}

