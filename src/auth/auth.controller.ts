import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { User, UserRole } from '../database/entities/users.entity';
import { TokenResponseDto } from './dto/token-response.dto';
import { UserSubscription, SubscriptionStatus } from '../database/entities/user-subscriptions.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepository: Repository<UserSubscription>,
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
  async getProfile(@CurrentUser() user: User): Promise<Partial<User> & { subscription?: UserSubscription | null }> {
    // Retornar datos del usuario sin información sensible
    const { passwordHash, refreshTokenHash, ...userProfile } = user;
    
    // Si el usuario es cliente, incluir su suscripción activa
    if (user.role === UserRole.CUSTOMER) {
      const subscription = await this.userSubscriptionRepository.findOne({
        where: {
          user: { id: user.id },
          status: SubscriptionStatus.ACTIVE,
        },
        relations: ['plan', 'billingCycle'],
        order: {
          createdAt: 'DESC', // Obtener la más reciente
        },
      });
      
      return {
        ...userProfile,
        subscription: subscription || null,
      };
    }
    
    return userProfile;
  }
}

