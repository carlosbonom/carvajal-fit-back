import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../database/entities/subscription-plans.entity';
import { SubscriptionPrice } from '../database/entities/subscription-prices.entity';
import { UserSubscription, SubscriptionStatus } from '../database/entities/user-subscriptions.entity';
import { BillingCycle } from '../database/entities/billing-cycles.entity';
import { User } from '../database/entities/users.entity';
import {
  SubscriptionPlanDto,
  SubscriptionPriceDto,
  BillingCycleDto,
} from './dto/subscription-plan-response.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { UserSubscriptionDto, BillingCycleInfoDto } from './dto/user-subscription-response.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { MercadoPagoService } from './mercado-pago.service';
import { SubscriptionPayment, PaymentStatus } from '../database/entities/subscription-payments.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionPrice)
    private readonly subscriptionPriceRepository: Repository<SubscriptionPrice>,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(BillingCycle)
    private readonly billingCycleRepository: Repository<BillingCycle>,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepository: Repository<SubscriptionPayment>,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  async getAvailablePlans(): Promise<SubscriptionPlanDto[]> {
    // Obtener todos los planes activos ordenados por sort_order
    const plans = await this.subscriptionPlanRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    // Para cada plan, obtener sus precios activos con sus billing cycles
    const plansWithPrices = await Promise.all(
      plans.map(async (plan) => {
        const prices = await this.subscriptionPriceRepository
          .createQueryBuilder('price')
          .leftJoinAndSelect('price.billingCycle', 'billingCycle')
          .where('price.plan_id = :planId', { planId: plan.id })
          .andWhere('price.is_active = :isActive', { isActive: true })
          .orderBy('billingCycle.slug', 'ASC')
          .getMany();

        const priceDtos: SubscriptionPriceDto[] = prices.map((price) => ({
          id: price.id,
          currency: price.currency,
          amount: parseFloat(price.amount.toString()),
          billingCycle: {
            id: price.billingCycle.id,
            name: price.billingCycle.name,
            slug: price.billingCycle.slug,
            intervalType: price.billingCycle.intervalType,
            intervalCount: price.billingCycle.intervalCount,
          } as BillingCycleDto,
        }));

        return {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description || '',
          features: plan.features || [],
          prices: priceDtos,
        } as SubscriptionPlanDto;
      }),
    );

    return plansWithPrices;
  }

  async createSubscription(
    user: User,
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    // Validar que el plan existe y está activo
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: createSubscriptionDto.planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan de suscripción no encontrado o no está activo');
    }

    // Validar que el billing cycle existe
    const billingCycle = await this.billingCycleRepository.findOne({
      where: { id: createSubscriptionDto.billingCycleId },
    });

    if (!billingCycle) {
      throw new NotFoundException('Ciclo de facturación no encontrado');
    }

    // Obtener el precio del plan para el billing cycle y moneda especificados
    const currency = createSubscriptionDto.currency || user.preferredCurrency || 'CLP';
    const price = await this.subscriptionPriceRepository.findOne({
      where: {
        plan: { id: plan.id },
        billingCycle: { id: billingCycle.id },
        currency: currency,
        isActive: true,
      },
      relations: ['plan', 'billingCycle'],
    });

    if (!price) {
      throw new NotFoundException(
        `No se encontró un precio activo para este plan, ciclo de facturación y moneda (${currency})`,
      );
    }

    // Verificar si el usuario ya tiene una suscripción activa
    const existingSubscription = await this.userSubscriptionRepository.findOne({
      where: {
        user: { id: user.id },
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('Ya tienes una suscripción activa');
    }

    // Calcular fechas del período
    const now = new Date();
    const periodStart = new Date(now);
    const periodEnd = this.calculatePeriodEnd(now, billingCycle.intervalType, billingCycle.intervalCount);

    // Crear la suscripción en nuestra base de datos primero (con estado pending)
    const userSubscription = this.userSubscriptionRepository.create({
      user,
      plan,
      billingCycle,
      status: SubscriptionStatus.PAYMENT_FAILED, // Inicialmente pending hasta que el usuario autorice
      startedAt: now,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      autoRenew: true,
    });

    const savedSubscription = await this.userSubscriptionRepository.save(userSubscription);

    try {
      // Crear la suscripción en Mercado Pago
      const mercadoPagoResponse = await this.mercadoPagoService.createSubscription({
        planId: plan.id,
        planName: plan.name,
        amount: parseFloat(price.amount.toString()),
        currency: currency,
        billingCycleSlug: billingCycle.slug,
        intervalType: billingCycle.intervalType,
        intervalCount: billingCycle.intervalCount,
        payerEmail: createSubscriptionDto.payerEmail || user.email,
        paymentMethodId: null, // No se envía al crear, se obtiene después de la autorización
        payerFirstName: createSubscriptionDto.payerFirstName || user.name?.split(' ')[0],
        payerLastName: createSubscriptionDto.payerLastName || user.name?.split(' ').slice(1).join(' '),
        payerIdentificationType: createSubscriptionDto.payerIdentificationType,
        payerIdentificationNumber: createSubscriptionDto.payerIdentificationNumber,
        externalReference: savedSubscription.id,
        backUrl: createSubscriptionDto.backUrl,
      });

      // Validar que el ID existe
      if (!mercadoPagoResponse.id) {
        throw new BadRequestException('No se recibió un ID de suscripción de Mercado Pago');
      }

      // Actualizar la suscripción con el ID de Mercado Pago
      savedSubscription.mercadoPagoSubscriptionId = mercadoPagoResponse.id.toString();
      savedSubscription.metadata = {
        mercadoPagoStatus: mercadoPagoResponse.status,
        initPoint: mercadoPagoResponse.initPoint,
        sandboxInitPoint: mercadoPagoResponse.sandboxInitPoint || null,
      };

      // El estado inicial será 'pending' hasta que el usuario autorice el pago
      // Una vez autorizado, Mercado Pago enviará un webhook y actualizaremos el estado
      if (mercadoPagoResponse.status === 'authorized') {
        savedSubscription.status = SubscriptionStatus.ACTIVE;
      } else {
        // Si está pendiente, mantenemos el estado como PAYMENT_FAILED hasta la autorización
        savedSubscription.status = SubscriptionStatus.PAYMENT_FAILED;
      }

      await this.userSubscriptionRepository.save(savedSubscription);

      return {
        id: savedSubscription.id,
        status: savedSubscription.status,
        mercadoPagoSubscriptionId: mercadoPagoResponse.id.toString(),
        initPoint: mercadoPagoResponse.initPoint || mercadoPagoResponse.sandboxInitPoint || '',
        message: 'Suscripción creada exitosamente',
      };
    } catch (error) {
      // Si falla la creación en Mercado Pago, eliminar la suscripción local
      await this.userSubscriptionRepository.remove(savedSubscription);
      throw error;
    }
  }

  async handleWebhook(notification: any): Promise<void> {
    try {
      const { type, data } = notification;

      // Obtener el ID de la suscripción desde Mercado Pago
      if (!data?.id) {
        console.error('Webhook sin ID de suscripción:', notification);
        return;
      }

      const mercadoPagoSubscriptionId = data.id.toString();

      // Buscar la suscripción en nuestra base de datos
      const subscription = await this.userSubscriptionRepository.findOne({
        where: { mercadoPagoSubscriptionId },
        relations: ['user', 'plan', 'billingCycle'],
      });

      if (!subscription) {
        console.warn(
          `Suscripción no encontrada para mercadoPagoSubscriptionId: ${mercadoPagoSubscriptionId}`,
        );
        return;
      }

      // Obtener información actualizada de Mercado Pago
      const mpSubscription = await this.mercadoPagoService.getSubscription(mercadoPagoSubscriptionId);

      // Actualizar metadata con la información más reciente
      subscription.metadata = {
        ...subscription.metadata,
        mercadoPagoStatus: mpSubscription.status,
        lastWebhookType: type,
        lastWebhookDate: new Date().toISOString(),
        mpSubscriptionData: mpSubscription,
      };

      // Procesar según el tipo de notificación
      switch (type) {
        case 'subscription_preapproval':
          await this.handlePreapprovalNotification(subscription, mpSubscription);
          break;

        case 'subscription_authorized_payment':
          await this.handleAuthorizedPaymentNotification(subscription, mpSubscription);
          break;

        case 'subscription_payment':
          await this.handlePaymentNotification(subscription, mpSubscription, notification);
          break;

        case 'payment':
          // Notificación de pago individual (puede ser de una suscripción)
          await this.handlePaymentNotification(subscription, mpSubscription, notification);
          break;

        default:
          console.log(`Tipo de notificación no manejado: ${type}`);
          // Actualizar estado según el estado de MP aunque no sea un tipo específico
          await this.updateSubscriptionStatusFromMP(subscription, mpSubscription);
      }

      await this.userSubscriptionRepository.save(subscription);
    } catch (error) {
      console.error('Error procesando webhook de Mercado Pago:', error);
      throw error;
    }
  }

  private async handlePreapprovalNotification(
    subscription: UserSubscription,
    mpSubscription: any,
  ): Promise<void> {
    // Cuando se crea o actualiza una suscripción (preapproval)
    await this.updateSubscriptionStatusFromMP(subscription, mpSubscription);
  }

  private async handleAuthorizedPaymentNotification(
    subscription: UserSubscription,
    mpSubscription: any,
  ): Promise<void> {
    // Cuando se autoriza un pago recurrente
    if (mpSubscription.status === 'authorized') {
      subscription.status = SubscriptionStatus.ACTIVE;
      
      // Actualizar fechas del período si están disponibles
      if (mpSubscription.auto_recurring?.start_date) {
        subscription.currentPeriodStart = new Date(mpSubscription.auto_recurring.start_date);
      }
      if (mpSubscription.auto_recurring?.end_date) {
        subscription.currentPeriodEnd = new Date(mpSubscription.auto_recurring.end_date);
      } else {
        // Calcular fecha de fin basada en el billing cycle
        subscription.currentPeriodEnd = this.calculatePeriodEnd(
          subscription.currentPeriodStart,
          subscription.billingCycle.intervalType,
          subscription.billingCycle.intervalCount,
        );
      }
    }
  }

  private async handlePaymentNotification(
    subscription: UserSubscription,
    mpSubscription: any,
    notification: any,
  ): Promise<void> {
    // Cuando se procesa un pago recurrente
    // Mercado Pago envía automáticamente una notificación cada vez que se cobra (mes a mes, año a año)
    
    try {
      // Obtener información del pago desde Mercado Pago
      // El notification.data.id puede ser el ID del pago o de la suscripción
      let paymentId = notification.data?.id;
      
      // Si el tipo es 'payment', el ID es del pago directamente
      // Si es 'subscription_payment', necesitamos obtener el último pago de la suscripción
      if (notification.type === 'subscription_payment') {
        // Para subscription_payment, el ID en data.id es de la suscripción
        // Necesitamos obtener los pagos asociados desde la suscripción
        // Por ahora, usamos el ID de la suscripción para obtener información actualizada
        paymentId = null; // No tenemos el ID del pago directamente en este caso
      }

      // Si tenemos el ID del pago, obtener su información
      if (paymentId && notification.type === 'payment') {
        try {
          const mpPayment = await this.mercadoPagoService.getPayment(paymentId.toString());
          
          // Verificar si el pago está relacionado con esta suscripción
          if (mpPayment.external_reference === subscription.id || 
              mpPayment.metadata?.subscription_id === subscription.mercadoPagoSubscriptionId) {
            
            // Buscar si ya existe un registro de pago con este transaction_id
            let paymentRecord = await this.subscriptionPaymentRepository.findOne({
              where: { transactionId: mpPayment.id?.toString() },
            });

            if (!paymentRecord) {
              // Validar que el status existe
              const paymentStatus = mpPayment.status || 'pending';
              
              // Crear nuevo registro de pago
              const newPayment = new SubscriptionPayment();
              newPayment.userSubscription = subscription;
              newPayment.user = subscription.user;
              newPayment.amount = mpPayment.transaction_amount || 0;
              newPayment.currency = mpPayment.currency_id || 'CLP';
              newPayment.status = this.mapMPPaymentStatusToOurStatus(paymentStatus);
              newPayment.paymentMethod = mpPayment.payment_method_id || null;
              newPayment.paymentProvider = 'mercadopago';
              newPayment.transactionId = mpPayment.id?.toString() || null;
              newPayment.periodStart = subscription.currentPeriodStart;
              newPayment.periodEnd = subscription.currentPeriodEnd;
              newPayment.paidAt = mpPayment.date_approved ? new Date(mpPayment.date_approved) : null;
              newPayment.metadata = {
                mpPaymentData: mpPayment,
                notificationType: notification.type,
              };
              
              paymentRecord = await this.subscriptionPaymentRepository.save(newPayment);

              // Si el pago fue aprobado, actualizar el período de la suscripción
              if (mpPayment.status === 'approved') {
                const now = new Date();
                subscription.currentPeriodStart = now;
                subscription.currentPeriodEnd = this.calculatePeriodEnd(
                  now,
                  subscription.billingCycle.intervalType,
                  subscription.billingCycle.intervalCount,
                );
                subscription.status = SubscriptionStatus.ACTIVE;
              }
            } else {
              // Validar que el status existe
              const paymentStatus = mpPayment.status || 'pending';
              
              // Actualizar el registro existente
              paymentRecord.status = this.mapMPPaymentStatusToOurStatus(paymentStatus);
              paymentRecord.paidAt = mpPayment.date_approved ? new Date(mpPayment.date_approved) : paymentRecord.paidAt;
              paymentRecord.metadata = {
                ...paymentRecord.metadata,
                mpPaymentData: mpPayment,
                lastUpdated: new Date().toISOString(),
              };
              await this.subscriptionPaymentRepository.save(paymentRecord);
            }
          }
        } catch (error) {
          console.error('Error obteniendo información del pago desde MP:', error);
          // Continuar con la actualización del estado de la suscripción aunque falle
        }
      }

      // Actualizar estado de la suscripción según el estado de MP
      await this.updateSubscriptionStatusFromMP(subscription, mpSubscription);
    } catch (error) {
      console.error('Error procesando notificación de pago:', error);
      // Aun así, actualizar el estado de la suscripción
      await this.updateSubscriptionStatusFromMP(subscription, mpSubscription);
    }
  }

  private mapMPPaymentStatusToOurStatus(mpStatus: string): PaymentStatus {
    switch (mpStatus) {
      case 'approved':
        return PaymentStatus.COMPLETED;
      case 'pending':
      case 'in_process':
        return PaymentStatus.PENDING;
      case 'rejected':
      case 'cancelled':
      case 'refunded':
      case 'charged_back':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private async updateSubscriptionStatusFromMP(
    subscription: UserSubscription,
    mpSubscription: any,
  ): Promise<void> {
    // Mapear estados de Mercado Pago a nuestros estados
    const mpStatus = mpSubscription.status;

    switch (mpStatus) {
      case 'authorized':
        subscription.status = SubscriptionStatus.ACTIVE;
        break;
      case 'paused':
        subscription.status = SubscriptionStatus.PAUSED;
        break;
      case 'cancelled':
        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.cancelledAt = new Date();
        break;
      case 'pending':
        // Mantener el estado actual o cambiar a PAYMENT_FAILED si estaba activa
        if (subscription.status === SubscriptionStatus.ACTIVE) {
          subscription.status = SubscriptionStatus.PAYMENT_FAILED;
        }
        break;
      default:
        console.log(`Estado de MP no reconocido: ${mpStatus}`);
    }
  }

  private calculatePeriodEnd(startDate: Date, intervalType: string, intervalCount: number): Date {
    const endDate = new Date(startDate);

    switch (intervalType) {
      case 'day':
        endDate.setDate(endDate.getDate() + intervalCount);
        break;
      case 'week':
        endDate.setDate(endDate.getDate() + intervalCount * 7);
        break;
      case 'month':
        endDate.setMonth(endDate.getMonth() + intervalCount);
        break;
      case 'year':
        endDate.setFullYear(endDate.getFullYear() + intervalCount);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }

    return endDate;
  }

  async getUserSubscription(userId: string): Promise<UserSubscriptionDto | null> {
    const subscription = await this.userSubscriptionRepository.findOne({
      where: { user: { id: userId } },
      relations: ['plan', 'billingCycle'],
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      return null;
    }

    // Obtener precios del plan
    const prices = await this.subscriptionPriceRepository
      .createQueryBuilder('price')
      .leftJoinAndSelect('price.billingCycle', 'billingCycle')
      .where('price.plan_id = :planId', { planId: subscription.plan.id })
      .andWhere('price.is_active = :isActive', { isActive: true })
      .orderBy('billingCycle.slug', 'ASC')
      .getMany();

    const priceDtos = prices.map((price) => ({
      id: price.id,
      currency: price.currency,
      amount: parseFloat(price.amount.toString()),
      billingCycle: {
        id: price.billingCycle.id,
        name: price.billingCycle.name,
        slug: price.billingCycle.slug,
        intervalType: price.billingCycle.intervalType,
        intervalCount: price.billingCycle.intervalCount,
      } as BillingCycleDto,
    }));

    return {
      id: subscription.id,
      status: subscription.status,
      startedAt: subscription.startedAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      autoRenew: subscription.autoRenew,
      cancellationReason: subscription.cancellationReason,
      mercadoPagoSubscriptionId: subscription.mercadoPagoSubscriptionId,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        description: subscription.plan.description || '',
        features: subscription.plan.features || [],
        prices: priceDtos,
      },
      billingCycle: {
        id: subscription.billingCycle.id,
        name: subscription.billingCycle.name,
        slug: subscription.billingCycle.slug,
        intervalType: subscription.billingCycle.intervalType,
        intervalCount: subscription.billingCycle.intervalCount,
      } as BillingCycleInfoDto,
      metadata: subscription.metadata,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  async cancelSubscription(
    userId: string,
    cancelDto: CancelSubscriptionDto,
  ): Promise<{ message: string; subscription: UserSubscriptionDto }> {
    const subscription = await this.userSubscriptionRepository.findOne({
      where: {
        user: { id: userId },
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan', 'billingCycle'],
    });

    if (!subscription) {
      throw new NotFoundException('No se encontró una suscripción activa para cancelar');
    }

    // Cancelar en Mercado Pago si tiene ID
    if (subscription.mercadoPagoSubscriptionId) {
      try {
        await this.mercadoPagoService.cancelSubscription(subscription.mercadoPagoSubscriptionId);
      } catch (error) {
        console.error('Error cancelando suscripción en Mercado Pago:', error);
        // Continuar con la cancelación local aunque falle en MP
      }
    }

    // Actualizar estado local
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = cancelDto.reason || null;
    subscription.autoRenew = false;

    await this.userSubscriptionRepository.save(subscription);

    // Obtener precios para la respuesta
    const prices = await this.subscriptionPriceRepository
      .createQueryBuilder('price')
      .leftJoinAndSelect('price.billingCycle', 'billingCycle')
      .where('price.plan_id = :planId', { planId: subscription.plan.id })
      .andWhere('price.is_active = :isActive', { isActive: true })
      .orderBy('billingCycle.slug', 'ASC')
      .getMany();

    const priceDtos = prices.map((price) => ({
      id: price.id,
      currency: price.currency,
      amount: parseFloat(price.amount.toString()),
      billingCycle: {
        id: price.billingCycle.id,
        name: price.billingCycle.name,
        slug: price.billingCycle.slug,
        intervalType: price.billingCycle.intervalType,
        intervalCount: price.billingCycle.intervalCount,
      } as BillingCycleDto,
    }));

    const subscriptionDto: UserSubscriptionDto = {
      id: subscription.id,
      status: subscription.status,
      startedAt: subscription.startedAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      autoRenew: subscription.autoRenew,
      cancellationReason: subscription.cancellationReason,
      mercadoPagoSubscriptionId: subscription.mercadoPagoSubscriptionId,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        description: subscription.plan.description || '',
        features: subscription.plan.features || [],
        prices: priceDtos,
      },
      billingCycle: {
        id: subscription.billingCycle.id,
        name: subscription.billingCycle.name,
        slug: subscription.billingCycle.slug,
        intervalType: subscription.billingCycle.intervalType,
        intervalCount: subscription.billingCycle.intervalCount,
      } as BillingCycleInfoDto,
      metadata: subscription.metadata,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };

    return {
      message: 'Suscripción cancelada exitosamente',
      subscription: subscriptionDto,
    };
  }

  async getSubscriptionPayments(userId: string): Promise<SubscriptionPayment[]> {
    const subscription = await this.userSubscriptionRepository.findOne({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      return [];
    }

    return this.subscriptionPaymentRepository.find({
      where: {
        userSubscription: { id: subscription.id },
      },
      order: { createdAt: 'DESC' },
    });
  }
}

