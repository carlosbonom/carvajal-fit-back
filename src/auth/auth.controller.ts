import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordChangeDto } from './dto/request-password-change.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyPasswordChangeDto } from './dto/verify-password-change.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { User } from '../database/entities/users.entity';
import { TokenResponseDto } from './dto/token-response.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<TokenResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: User): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    return { message: 'Sesión cerrada exitosamente' };
  }

  @Public()
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: User,
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(user, refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: User) {
    // Retornar datos del usuario sin información sensible
    const { passwordHash, refreshTokenHash, ...userProfile } = user;
    
    // Obtener suscripción del usuario (si existe, sin importar el estado)
    const subscription = await this.subscriptionsService.getUserSubscription(user.id);
    
    return {
      ...userProfile,
      subscription: subscription || null,
    };
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.requestPasswordChangeByEmail(forgotDto.email);
  }

  @Post('password/request-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async requestPasswordChange(
    @CurrentUser() user: User,
    @Body() requestDto: RequestPasswordChangeDto,
  ): Promise<{ message: string }> {
    return this.authService.requestPasswordChange(user);
  }

  @Post('password/verify-and-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyAndChangePassword(
    @CurrentUser() user: User,
    @Body() verifyDto: VerifyPasswordChangeDto,
  ): Promise<{ message: string }> {
    return this.authService.verifyAndChangePassword(user, verifyDto);
  }
}

