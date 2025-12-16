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
  Query,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/non-admin.guard';
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
import { GetMembersQueryDto } from './dto/get-members-query.dto';
import { MembersResponseDto } from './dto/members-response.dto';
import { CreateWebpayTransactionDto, ValidateWebpayPaymentDto } from './dto/create-webpay-transaction.dto';
import { CreatePayPalOrderDto, ValidatePayPalPaymentDto } from './dto/create-paypal-order.dto';
import { VerifyPayPalCaptureDto } from './dto/verify-paypal-capture.dto';
import { CreateMercadoPagoCheckoutDto, ValidateMercadoPagoPaymentDto } from './dto/create-mercadopago-checkout.dto';

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

  @Get('members')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getMembers(@Query() query: GetMembersQueryDto): Promise<MembersResponseDto> {
    return this.subscriptionsService.getMembers(query);
  }

  @Post('webpay/create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createWebpayTransaction(
    @CurrentUser() user: User,
    @Body() createWebpayDto: CreateWebpayTransactionDto,
  ): Promise<{ token: string; url: string; subscriptionId: string }> {
    return this.subscriptionsService.createWebpayTransaction(
      user,
      createWebpayDto.planId,
      createWebpayDto.billingCycleId,
      createWebpayDto.currency,
    );
  }

  @Post('webpay/validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  async validateWebpayPayment(
    @Body() validateDto: ValidateWebpayPaymentDto,
    @Query('subscriptionId') subscriptionId?: string,
  ): Promise<{
    success: boolean;
    subscription?: UserSubscriptionDto;
    redirectUrl?: string;
  }> {
    const result = await this.subscriptionsService.validateWebpayPayment(
      validateDto.token,
      subscriptionId,
    );

    // Convertir subscription a DTO si existe
    let subscriptionDto: UserSubscriptionDto | undefined;
    if (result.subscription) {
      const sub = result.subscription;
      subscriptionDto = {
        id: sub.id,
        status: sub.status,
        startedAt: sub.startedAt,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelledAt: sub.cancelledAt,
        autoRenew: sub.autoRenew,
        cancellationReason: sub.cancellationReason,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          slug: sub.plan.slug,
          description: sub.plan.description,
          features: sub.plan.features || [],
          prices: [],
        },
        billingCycle: {
          id: sub.billingCycle.id,
          name: sub.billingCycle.name,
          slug: sub.billingCycle.slug,
          intervalType: sub.billingCycle.intervalType,
          intervalCount: sub.billingCycle.intervalCount,
        },
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      };
    }

    return {
      success: result.success,
      subscription: subscriptionDto,
      redirectUrl: result.redirectUrl,
    };
  }

  @Post('paypal/create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createPayPalOrder(
    @CurrentUser() user: User,
    @Body() createPayPalDto: CreatePayPalOrderDto,
  ): Promise<{ orderId: string; approveUrl: string; subscriptionId: string }> {
    return this.subscriptionsService.createPayPalOrder(
      user,
      createPayPalDto.planId,
      createPayPalDto.billingCycleId,
      createPayPalDto.currency,
    );
  }

  @Post('paypal/validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  async validatePayPalPayment(
    @Body() validateDto: ValidatePayPalPaymentDto,
    @Query('subscriptionId') subscriptionId?: string,
  ): Promise<{
    success: boolean;
    subscription?: UserSubscriptionDto;
    redirectUrl?: string;
  }> {
    const result = await this.subscriptionsService.validatePayPalPayment(
      validateDto.orderId,
      subscriptionId,
    );

    // Convertir subscription a DTO si existe
    let subscriptionDto: UserSubscriptionDto | undefined;
    if (result.subscription) {
      const sub = result.subscription;
      subscriptionDto = {
        id: sub.id,
        status: sub.status,
        startedAt: sub.startedAt,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelledAt: sub.cancelledAt,
        autoRenew: sub.autoRenew,
        cancellationReason: sub.cancellationReason,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          slug: sub.plan.slug,
          description: sub.plan.description,
          features: sub.plan.features || [],
          prices: [],
        },
        billingCycle: {
          id: sub.billingCycle.id,
          name: sub.billingCycle.name,
          slug: sub.billingCycle.slug,
          intervalType: sub.billingCycle.intervalType,
          intervalCount: sub.billingCycle.intervalCount,
        },
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      };
    }

    return {
      success: result.success,
      subscription: subscriptionDto,
      redirectUrl: result.redirectUrl,
    };
  }

  @Post('paypal/verify-capture')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyPayPalCapture(
    @Body() verifyDto: VerifyPayPalCaptureDto,
  ): Promise<{
    status: string;
    capture: any;
  }> {
    return this.subscriptionsService.verifyPayPalCapture(verifyDto.captureId);
  }

  @Post('mercadopago/create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createMercadoPagoCheckout(
    @CurrentUser() user: User,
    @Body() createMercadoPagoDto: CreateMercadoPagoCheckoutDto,
  ): Promise<{ preferenceId: string; initPoint: string; subscriptionId: string }> {
    return this.subscriptionsService.createMercadoPagoCheckout(
      user,
      createMercadoPagoDto.planId,
      createMercadoPagoDto.billingCycleId,
      createMercadoPagoDto.currency,
    );
  }

  @Post('mercadopago/validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  async validateMercadoPagoPayment(
    @Body() validateDto: ValidateMercadoPagoPaymentDto,
    @Query('subscriptionId') subscriptionId?: string,
  ): Promise<{
    success: boolean;
    subscription?: UserSubscriptionDto;
    redirectUrl?: string;
  }> {
    const result = await this.subscriptionsService.validateMercadoPagoPayment(
      validateDto.paymentId,
      subscriptionId,
    );

    // Convertir subscription a DTO si existe
    let subscriptionDto: UserSubscriptionDto | undefined;
    if (result.subscription) {
      const sub = result.subscription;
      subscriptionDto = {
        id: sub.id,
        status: sub.status,
        startedAt: sub.startedAt,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelledAt: sub.cancelledAt,
        autoRenew: sub.autoRenew,
        cancellationReason: sub.cancellationReason,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          slug: sub.plan.slug,
          description: sub.plan.description,
          features: sub.plan.features || [],
          prices: [],
        },
        billingCycle: {
          id: sub.billingCycle.id,
          name: sub.billingCycle.name,
          slug: sub.billingCycle.slug,
          intervalType: sub.billingCycle.intervalType,
          intervalCount: sub.billingCycle.intervalCount,
        },
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      };
    }

    return {
      success: result.success,
      subscription: subscriptionDto,
      redirectUrl: result.redirectUrl,
    };
  }
}

