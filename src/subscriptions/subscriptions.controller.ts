import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';
import { SubscriptionPlansResponseDto, SubscriptionPlanDto } from './dto/subscription-plan-response.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { WebhookNotificationDto } from './dto/webhook-notification.dto';
import { UserSubscriptionDto } from './dto/user-subscription-response.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { SubscriptionPayment } from '../database/entities/subscription-payments.entity';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  async getAvailablePlans(): Promise<SubscriptionPlansResponseDto> {
    const plans = await this.subscriptionsService.getAvailablePlans();
    return { plans };
  }

  @Put('plans/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateSubscriptionPlan(
    @Param('id') id: string,
    @Body() updateDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanDto> {
    return this.subscriptionsService.updateSubscriptionPlan(id, updateDto);
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @CurrentUser() user: User,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.createSubscription(user, createSubscriptionDto);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: WebhookNotificationDto,
  ): Promise<{ received: boolean }> {
    try {
      // Mercado Pago envía notificaciones con información sobre el tipo y el ID del recurso
      // El body contiene información sobre el tipo de notificación
      // Tipos comunes: subscription_preapproval, subscription_authorized_payment, subscription_payment

      const notification = body;

      // Validar que la notificación tenga la estructura esperada
      if (!notification.type || !notification.data?.id) {
        console.warn('Notificación de webhook con estructura inválida:', notification);
        return { received: true }; // Retornar 200 para que MP no reintente
      }

      // Procesar la notificación
      await this.subscriptionsService.handleWebhook(notification);

      return { received: true };
    } catch (error) {
      // Log del error pero retornar 200 para que MP no reintente
      // En producción, podrías querer retornar 500 para que MP reintente
      console.error('Error procesando webhook de Mercado Pago:', error);
      return { received: true };
    }
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @CurrentUser() user: User,
    @Body() cancelDto: CancelSubscriptionDto,
  ) {
    return this.subscriptionsService.cancelSubscription(user.id, cancelDto);
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard)
  async getMyPayments(@CurrentUser() user: User): Promise<{ payments: SubscriptionPayment[] }> {
    const payments = await this.subscriptionsService.getSubscriptionPayments(user.id);
    return { payments };
  }
}

