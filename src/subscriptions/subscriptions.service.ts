import { Injectable, NotFoundException, BadRequestException, HttpStatus, HttpCode } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../database/entities/subscription-plans.entity';
import { SubscriptionPrice } from '../database/entities/subscription-prices.entity';
import { UserSubscription, SubscriptionStatus } from '../database/entities/user-subscriptions.entity';
import { BillingCycle } from '../database/entities/billing-cycles.entity';
import { User, UserRole, UserStatus } from '../database/entities/users.entity';
import {
  SubscriptionPlanDto,
  SubscriptionPriceDto,
  BillingCycleDto,
} from './dto/subscription-plan-response.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { UserSubscriptionDto, BillingCycleInfoDto } from './dto/user-subscription-response.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { MercadoPagoService } from './mercado-pago.service';
import { MercadoPagoCheckoutService } from '../payments/mercado-pago-checkout.service';
import { WebpayService } from '../payments/webpay.service';
import { PayPalService } from '../payments/paypal.service';
import { SubscriptionPayment, PaymentStatus } from '../database/entities/subscription-payments.entity';
import { UserContentProgress } from '../database/entities/user-content-progress.entity';
import { Content } from '../database/entities/content.entity';
import { MarketService } from '../market/market.service';
import { GetMembersQueryDto } from './dto/get-members-query.dto';
import { MembersResponseDto, MemberDto, MemberStatsDto } from './dto/members-response.dto';
import { MarketingService } from '../marketing/marketing.service';
import { LiorenService } from '../lioren/lioren.service';
import { ConfigService } from '@nestjs/config';
import { PasswordResetCode } from '../database/entities/password-reset-code.entity';
import { UpdateMemberDto } from './dto/update-member.dto';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserContentProgress)
    private readonly userContentProgressRepository: Repository<UserContentProgress>,
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
    @InjectRepository(PasswordResetCode)
    private readonly passwordResetCodeRepository: Repository<PasswordResetCode>,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly mercadoPagoCheckoutService: MercadoPagoCheckoutService,
    private readonly webpayService: WebpayService,
    private readonly paypalService: PayPalService,
    private readonly marketingService: MarketingService,
    private readonly liorenService: LiorenService,
    private readonly marketService: MarketService,
    private readonly configService: ConfigService,
  ) { }

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

  async updateSubscriptionPlan(
    id: string,
    updateDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanDto> {
    // Buscar el plan existente
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan de suscripción con ID ${id} no encontrado`);
    }

    // Validar que el slug no esté en uso por otro plan si se está actualizando
    if (updateDto.slug && updateDto.slug !== plan.slug) {
      const existingPlanWithSlug = await this.subscriptionPlanRepository.findOne({
        where: { slug: updateDto.slug },
      });

      if (existingPlanWithSlug && existingPlanWithSlug.id !== id) {
        throw new BadRequestException(`Ya existe un plan con el slug "${updateDto.slug}"`);
      }
    }

    // Actualizar los campos proporcionados
    Object.assign(plan, updateDto);

    // Guardar los cambios
    const updatedPlan = await this.subscriptionPlanRepository.save(plan);

    // Obtener los precios del plan actualizado
    const prices = await this.subscriptionPriceRepository
      .createQueryBuilder('price')
      .leftJoinAndSelect('price.billingCycle', 'billingCycle')
      .where('price.plan_id = :planId', { planId: updatedPlan.id })
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
      id: updatedPlan.id,
      name: updatedPlan.name,
      slug: updatedPlan.slug,
      description: updatedPlan.description || '',
      features: updatedPlan.features || [],
      prices: priceDtos,
    } as SubscriptionPlanDto;
  }

  async updatePrice(
    priceId: string,
    amount: number,
  ): Promise<SubscriptionPriceDto> {
    // Buscar el precio existente
    const price = await this.subscriptionPriceRepository.findOne({
      where: { id: priceId },
      relations: ['billingCycle'],
    });

    if (!price) {
      throw new NotFoundException(`Precio con ID ${priceId} no encontrado`);
    }

    // Validar que el monto sea válido
    if (amount < 0) {
      throw new BadRequestException('El monto debe ser mayor o igual a 0');
    }

    // Actualizar el monto
    price.amount = amount;
    await this.subscriptionPriceRepository.save(price);

    // Retornar el precio actualizado
    return {
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
    };
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
        amount: process.env.NODE_ENV !== 'production' ? (currency === 'USD' ? 1 : 950) : parseFloat(price.amount.toString()),
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

      if (!data?.id) {
        console.error('Webhook sin ID de recurso:', notification);
        return;
      }

      console.log(`🔔 Webhook Mercado Pago recibido: ${type} (ID: ${data.id})`);

      // 1. Manejar notificaciones de tipo 'payment' (pueden ser del Market o Cobros de Suscripción)
      if (type === 'payment') {
        const paymentId = data.id.toString();

        // Obtener detalles del pago para ver el external_reference
        const mpPayment = await this.mercadoPagoService.getPayment(paymentId);
        const externalReference = mpPayment.external_reference;

        if (!externalReference) {
          console.warn(`[Webhook] Pago ${paymentId} sin external_reference. No se puede rutear.`);
          return;
        }

        // ¿Es una orden del Market?
        const order = await this.marketService['ordersRepository'].findOne({
          where: { id: externalReference }
        });

        if (order) {
          console.log(`[Webhook] Ruteando pago ${paymentId} al MarketService (Orden: ${order.orderNumber})`);
          await this.marketService.handleMercadoPagoPayment(paymentId);
          return;
        }

        // ¿Es un pago de suscripción?
        const subscription = await this.userSubscriptionRepository.findOne({
          where: { id: externalReference },
          relations: ['user', 'plan', 'billingCycle'],
        });

        if (subscription) {
          console.log(`[Webhook] Ruteando pago ${paymentId} a SubscriptionsService (SubID: ${subscription.id})`);
          await this.handlePaymentNotification(subscription, null, notification); // Pass notification so it fetches the payment
          return;
        }

        console.warn(`[Webhook] External reference ${externalReference} no coincide con órdenes ni suscripciones.`);
        return;
      }

      // 2. Manejar notificaciones específicas de suscripciones (preapproval, authorized_payment, etc.)
      if (type.startsWith('subscription_')) {
        const mercadoPagoSubscriptionId = data.id.toString();

        // Buscar la suscripción por su ID de Mercado Pago
        const subscription = await this.userSubscriptionRepository.findOne({
          where: { mercadoPagoSubscriptionId },
          relations: ['user', 'plan', 'billingCycle'],
        });

        if (!subscription) {
          console.warn(`Suscripción no encontrada para mercadoPagoSubscriptionId: ${mercadoPagoSubscriptionId}`);
          return;
        }

        // Obtener información actualizada de Mercado Pago
        const mpSubscription = await this.mercadoPagoService.getSubscription(mercadoPagoSubscriptionId);

        // Actualizar metadata
        subscription.metadata = {
          ...subscription.metadata,
          mercadoPagoStatus: mpSubscription.status,
          lastWebhookType: type,
          lastWebhookDate: new Date().toISOString(),
          mpSubscriptionData: mpSubscription,
        };

        // Procesar según el tipo
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
          default:
            await this.updateSubscriptionStatusFromMP(subscription, mpSubscription);
        }

        await this.userSubscriptionRepository.save(subscription);
        return;
      }

      console.log(`Tipo de notificación no manejado por el ruteador universal: ${type}`);
    } catch (error) {
      console.error('Error procesando webhook universal de Mercado Pago:', error);
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

                // Generar Boleta de membresía
                let attachments: any[] = [];
                try {
                  const pdf = await this.generarBoletaParaPago(subscription, newPayment);
                  if (pdf) {
                    attachments.push({
                      filename: `boleta_${subscription.id}.pdf`,
                      content: pdf,
                    });
                  }
                } catch (error) {
                  console.error('Error generando boleta para email:', error);
                }

                // Enviar email de éxito
                await this.marketingService.sendSubscriptionPaymentSuccessEmail(
                  subscription.user.email,
                  subscription.user.name || 'Miembro',
                  subscription.plan.name,
                  Number(newPayment.amount),
                  subscription.currentPeriodEnd,
                  attachments,
                );
              } else if (['rejected', 'cancelled', 'charged_back'].includes(mpPayment.status)) {
                // Enviar email de fallo
                const appUrl = this.configService.get<string>('APP_URL') || 'https://carvajalfit.com';
                const retryLink = `${appUrl}/payment/${subscription.id}`;

                await this.marketingService.sendSubscriptionPaymentFailedEmail(
                  subscription.user.email,
                  subscription.user.name || 'Miembro',
                  subscription.plan.name,
                  retryLink,
                );
              }
            } else {
              // Validar que el status existe
              const paymentStatus = mpPayment.status || 'pending';
              const previousStatus = paymentRecord.status;

              // Actualizar el registro existente
              paymentRecord.status = this.mapMPPaymentStatusToOurStatus(paymentStatus);
              paymentRecord.paidAt = mpPayment.date_approved ? new Date(mpPayment.date_approved) : paymentRecord.paidAt;
              paymentRecord.metadata = {
                ...paymentRecord.metadata,
                mpPaymentData: mpPayment,
                lastUpdated: new Date().toISOString(),
              };
              await this.subscriptionPaymentRepository.save(paymentRecord);

              // Detectar cambio de estado a Aprobado para enviar email (si no se envió antes)
              if (previousStatus !== PaymentStatus.COMPLETED && paymentRecord.status === PaymentStatus.COMPLETED) {
                const now = new Date();
                // Recalcular fechas si faltaban
                if (!subscription.currentPeriodEnd || subscription.currentPeriodEnd < now) {
                  subscription.currentPeriodEnd = this.calculatePeriodEnd(
                    now,
                    subscription.billingCycle.intervalType,
                    subscription.billingCycle.intervalCount,
                  );
                }

                // Generar Boleta de membresía
                let attachments: any[] = [];
                try {
                  const pdf = await this.generarBoletaParaPago(subscription, paymentRecord);
                  if (pdf) {
                    attachments.push({
                      filename: `boleta_${subscription.id}.pdf`,
                      content: pdf,
                    });
                  }
                } catch (error) {
                  console.error('Error generando boleta para email:', error);
                }

                await this.marketingService.sendSubscriptionPaymentSuccessEmail(
                  subscription.user.email,
                  subscription.user.name || 'Miembro',
                  subscription.plan.name,
                  Number(paymentRecord.amount),
                  subscription.currentPeriodEnd,
                  attachments,
                );
              }
              // Detectar cambio a Fallido
              else if (previousStatus !== PaymentStatus.FAILED && paymentRecord.status === PaymentStatus.FAILED) {
                const appUrl = this.configService.get<string>('APP_URL') || 'https://carvajalfit.com';
                const retryLink = `${appUrl}/payment/${subscription.id}`;

                await this.marketingService.sendSubscriptionPaymentFailedEmail(
                  subscription.user.email,
                  subscription.user.name || 'Miembro',
                  subscription.plan.name,
                  retryLink,
                );
              }
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

  /**
   * Genera una boleta electrónica para un pago de membresía exitoso
   * Retorna el PDF de la boleta o null si hay algún error
   */
  private async generarBoletaParaPago(
    subscription: UserSubscription,
    payment: SubscriptionPayment,
  ): Promise<Buffer | null> {
    try {
      // Obtener RUT del usuario desde metadata del pago o suscripción, o usar un valor por defecto
      // NOTA: El RUT debería ser capturado durante el registro o checkout
      // Por ahora usamos un RUT genérico si no está disponible
      const userRut = payment.metadata?.userRut ||
        subscription.metadata?.userRut ||
        this.configService.get<string>('LIOREN_DEFAULT_RUT') ||
        '111111111'; // RUT genérico por defecto

      const userName = subscription.user.name || subscription.user.email.split('@')[0];
      const planName = subscription.plan.name;
      const billingCycle = subscription.billingCycle.intervalType === 'month' ? 'mensual' : 'anual';

      const descripcion = `Membresía ${planName} - ${billingCycle}`;

      const boletaData = await this.liorenService.generarBoletaMembresia(
        {
          rut: userRut,
          nombre: userName,
          email: subscription.user.email,
          direccion: payment.metadata?.direccion || subscription.metadata?.direccion,
          comuna: Number(payment.metadata?.comuna || subscription.metadata?.comuna || 1),
          ciudad: Number(payment.metadata?.ciudad || subscription.metadata?.ciudad || 1),
          telefono: subscription.user.phone || undefined,
        },
        {
          monto: Number(payment.amount),
          descripcion: descripcion,
          fechaPago: payment.paidAt || new Date(),
          referencia: payment.transactionId || payment.id,
        },
      );

      // Guardar el ID de la boleta en el metadata del pago
      payment.metadata = {
        ...payment.metadata,
        liorenBoletaId: boletaData.boleta.id,
        liorenFolio: boletaData.boleta.folio,
      };
      await this.subscriptionPaymentRepository.save(payment);

      return boletaData.pdf;
    } catch (error: any) {
      console.error('Error al generar boleta electrónica:', error);
      // No lanzamos error para no interrumpir el flujo de activación
      // La boleta es importante pero no crítica para la activación de la suscripción
      return null;
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

  async getPaymentDetails(id: string): Promise<any> {
    // 1. Intentar buscar como SubscriptionPayment
    const payment = await this.subscriptionPaymentRepository.findOne({
      where: { id },
      relations: ['userSubscription', 'userSubscription.plan', 'userSubscription.billingCycle', 'user'],
    });

    if (payment) {
      return {
        type: 'payment',
        id: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        planName: payment.userSubscription.plan.name,
        billingCycle: payment.userSubscription.billingCycle.name,
        userEmail: payment.user.email,
        userName: payment.user.name,
        createdAt: payment.createdAt,
        subscriptionId: payment.userSubscription.id,
      };
    }

    // 2. Intentar buscar como UserSubscription
    const subscription = await this.userSubscriptionRepository.findOne({
      where: { id },
      relations: ['plan', 'billingCycle', 'user'],
    });

    if (!subscription) {
      throw new NotFoundException('No se encontró información de pago o suscripción asociada al ID');
    }

    // Si es suscripción, buscar el precio actual
    const price = await this.subscriptionPriceRepository.findOne({
      where: {
        plan: { id: subscription.plan.id },
        billingCycle: { id: subscription.billingCycle.id },
        isActive: true, // Asumimos que queremos el precio actual activo
        // Si hay multiples monedas, deberíamos saber cual. Por defecto CLP o la del usuario.
        // Pero aquí no tenemos el contexto de checkoutDTO.
        // Vamos a intentar obtener el precio en la moneda preferida del usuario o CLP por defecto.
        currency: subscription.user.preferredCurrency || 'CLP',
      },
    });

    if (!price) {
      throw new NotFoundException('No se encontró un precio activo actual para esta suscripción');
    }

    return {
      type: 'subscription',
      id: subscription.id,
      amount: Number(price.amount),
      currency: price.currency,
      status: subscription.status, // ACTIVE, PAYMENT_FAILED, etc.
      planName: subscription.plan.name,
      billingCycle: subscription.billingCycle.name,
      userEmail: subscription.user.email,
      userName: subscription.user.name,
      createdAt: subscription.createdAt,
      subscriptionId: subscription.id,
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

  async getMembers(query: GetMembersQueryDto): Promise<MembersResponseDto> {
    // Construir query base para obtener todos los usuarios
    const userQueryBuilder = this.userRepository.createQueryBuilder('user');

    // Aplicar filtro de búsqueda por nombre o email
    if (query.search) {
      const searchTerm = query.search.trim();
      userQueryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    // Obtener todos los usuarios
    const users = await userQueryBuilder
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    // Obtener todas las suscripciones con sus relaciones
    const allSubscriptions = await this.userSubscriptionRepository.find({
      relations: ['user', 'plan', 'billingCycle'],
      order: { createdAt: 'DESC' },
    });

    // Crear un mapa de usuario -> suscripción más reciente
    const userSubscriptionMap = new Map<string, UserSubscription>();
    allSubscriptions.forEach((subscription) => {
      const userId = subscription.user.id;
      if (!userSubscriptionMap.has(userId)) {
        userSubscriptionMap.set(userId, subscription);
      } else {
        // Si ya existe, comparar fechas y quedarse con la más reciente
        const existing = userSubscriptionMap.get(userId);
        if (existing && subscription.createdAt > existing.createdAt) {
          userSubscriptionMap.set(userId, subscription);
        }
      }
    });

    // Filtrar usuarios por estado de suscripción si se especifica
    let filteredUsers = users;
    if (query.status) {
      filteredUsers = users.filter((user) => {
        const subscription = userSubscriptionMap.get(user.id);
        return subscription?.status === query.status;
      });
    }

    // Calcular estadísticas
    const total = users.length;
    const active = users.filter((user) => {
      const subscription = userSubscriptionMap.get(user.id);
      return subscription?.status === SubscriptionStatus.ACTIVE;
    }).length;
    const cancelled = users.filter((user) => {
      const subscription = userSubscriptionMap.get(user.id);
      return subscription?.status === SubscriptionStatus.CANCELLED;
    }).length;

    // Calcular ingresos mensuales (pagos completados del mes actual)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyPayments = await this.subscriptionPaymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paid_at >= :startOfMonth', { startOfMonth })
      .andWhere('payment.paid_at <= :endOfMonth', { endOfMonth })
      .getMany();

    const monthlyRevenue = monthlyPayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount.toString());
    }, 0);

    // Obtener todos los contenidos para calcular progreso
    const allContents = await this.contentRepository.find({
      where: { isActive: true },
    });
    const totalContents = allContents.length;

    // Construir lista de miembros con sus datos
    const members: MemberDto[] = await Promise.all(
      filteredUsers.map(async (user) => {
        const subscription = userSubscriptionMap.get(user.id);

        // Calcular progreso del usuario
        const userProgress = await this.userContentProgressRepository.find({
          where: { user: { id: user.id } },
        });

        const completedContents = userProgress.filter((p) => p.isCompleted).length;
        const progress = totalContents > 0 ? Math.round((completedContents / totalContents) * 100) : 0;

        // Calcular total pagado (sumar todos los pagos de todas las suscripciones del usuario)
        let totalPaid = 0;
        let currency = user.preferredCurrency || 'CLP';

        if (subscription) {
          const payments = await this.subscriptionPaymentRepository.find({
            where: {
              userSubscription: { id: subscription.id },
              status: PaymentStatus.COMPLETED,
            },
          });

          totalPaid = payments.reduce((sum, payment) => {
            return sum + parseFloat(payment.amount.toString());
          }, 0);

          if (payments.length > 0) {
            currency = payments[0].currency;
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          subscription: subscription
            ? {
              id: subscription.id,
              planName: subscription.plan.name,
              status: subscription.status,
              startedAt: subscription.startedAt,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
            }
            : null,
          progress,
          totalPaid,
          currency,
        };
      }),
    );

    return {
      stats: {
        total,
        active,
        cancelled,
        monthlyRevenue,
      },
      members,
      total,
    };
  }

  async updateMember(id: string, updateDto: UpdateMemberDto): Promise<any> {
    // 1. Buscar el usuario
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // 2. Actualizar campos del usuario
    if (updateDto.name !== undefined) user.name = updateDto.name;
    if (updateDto.email !== undefined) user.email = updateDto.email;
    if (updateDto.status !== undefined) user.status = updateDto.status;
    if (updateDto.currency !== undefined) user.preferredCurrency = updateDto.currency;

    if (updateDto.password !== undefined) {
      const SALT_ROUNDS = 10;
      user.passwordHash = await bcrypt.hash(updateDto.password, SALT_ROUNDS);
    }

    await this.userRepository.save(user);

    // 3. Buscar la suscripción más reciente
    const subscription = await this.userSubscriptionRepository.findOne({
      where: { user: { id } },
      relations: ['plan', 'billingCycle'],
      order: { createdAt: 'DESC' },
    });

    if (subscription) {
      // Actualizar campos de la suscripción si se proporcionan
      if (updateDto.subscriptionStatus !== undefined) {
        subscription.status = updateDto.subscriptionStatus;
      }

      if (updateDto.planId !== undefined) {
        const plan = await this.subscriptionPlanRepository.findOne({ where: { id: updateDto.planId } });
        if (plan) subscription.plan = plan;
      }

      if (updateDto.billingCycleId !== undefined) {
        const billingCycle = await this.billingCycleRepository.findOne({ where: { id: updateDto.billingCycleId } });
        if (billingCycle) subscription.billingCycle = billingCycle;
      }

      if (updateDto.startedAt !== undefined) {
        subscription.startedAt = new Date(updateDto.startedAt);
      }

      if (updateDto.currentPeriodStart !== undefined) {
        subscription.currentPeriodStart = new Date(updateDto.currentPeriodStart);
      }

      if (updateDto.currentPeriodEnd !== undefined) {
        subscription.currentPeriodEnd = new Date(updateDto.currentPeriodEnd);
      }

      await this.userSubscriptionRepository.save(subscription);
    }

    return { message: 'Miembro actualizado correctamente' };
  }

  /**
   * Crea una transacción de WebPay Plus para una suscripción
   */
  async createWebpayTransaction(
    user: User,
    planId: string,
    billingCycleId: string,
    currency?: string,
    subscriptionId?: string,
  ): Promise<{ token: string; url: string; subscriptionId: string }> {
    // Validar que el plan existe y está activo
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan de suscripción no encontrado o no está activo');
    }

    // Validar que el billing cycle existe
    const billingCycle = await this.billingCycleRepository.findOne({
      where: { id: billingCycleId },
    });

    if (!billingCycle) {
      throw new NotFoundException('Ciclo de facturación no encontrado');
    }

    // Obtener el precio del plan
    const finalCurrency = currency || user.preferredCurrency || 'CLP';
    const price = await this.subscriptionPriceRepository.findOne({
      where: {
        plan: { id: plan.id },
        billingCycle: { id: billingCycle.id },
        currency: finalCurrency,
        isActive: true,
      },
    });

    if (!price) {
      throw new NotFoundException(
        `No se encontró un precio activo para este plan, ciclo de facturación y moneda (${finalCurrency})`,
      );
    }

    // Verificar si el usuario ya tiene una suscripción activa (solo si es una nueva suscripción)
    if (!subscriptionId) {
      const existingSubscription = await this.userSubscriptionRepository.findOne({
        where: {
          user: { id: user.id },
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (existingSubscription) {
        throw new BadRequestException('Ya tienes una suscripción activa');
      }
    }

    let savedSubscription: UserSubscription;

    if (subscriptionId) {
      // Usar suscripción existente
      const existing = await this.userSubscriptionRepository.findOne({
        where: { id: subscriptionId },
        relations: ['user']
      });

      if (!existing) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      if (existing.user.id !== user.id) {
        throw new BadRequestException('La suscripción no pertenece al usuario');
      }

      // Actualizar metadata
      existing.metadata = {
        ...existing.metadata,
        paymentProvider: 'webpay',
        currency: finalCurrency,
        lastPaymentAttempt: new Date().toISOString()
      };

      savedSubscription = await this.userSubscriptionRepository.save(existing);
    } else {
      // Calcular fechas del período
      const now = new Date();
      const periodStart = new Date(now);
      const periodEnd = this.calculatePeriodEnd(now, billingCycle.intervalType, billingCycle.intervalCount);

      // Crear la suscripción en nuestra base de datos (con estado PAYMENT_FAILED hasta confirmar el pago)
      const userSubscription = this.userSubscriptionRepository.create({
        user,
        plan,
        billingCycle,
        status: SubscriptionStatus.PAYMENT_FAILED,
        startedAt: now,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        autoRenew: false, // WebPay no es recurrente, es un pago único
        metadata: {
          paymentProvider: 'webpay',
          currency: finalCurrency,
        },
      });

      savedSubscription = await this.userSubscriptionRepository.save(userSubscription);
    }

    // Crear la transacción en WebPay
    const buyOrder = `SUB-${savedSubscription.id.substring(0, 8).toUpperCase()}-${Date.now()}`;
    const sessionId = user.id;
    let amount = Math.round(parseFloat(price.amount.toString())); // WebPay requiere monto entero

    // Forzar precio en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      amount = 950;
    }
    const returnUrl = `${process.env.APP_URL || 'https://carvajalfit.com'}/checkout/success?subscriptionId=${savedSubscription.id}`;

    const webpayResponse = await this.webpayService.createTransaction({
      buyOrder,
      sessionId,
      amount,
      returnUrl,
    });

    // Actualizar la suscripción con el token de WebPay
    savedSubscription.metadata = {
      ...savedSubscription.metadata,
      webpayToken: webpayResponse.token,
      buyOrder,
      amount,
    };
    await this.userSubscriptionRepository.save(savedSubscription);

    return {
      token: webpayResponse.token,
      url: webpayResponse.url,
      subscriptionId: savedSubscription.id,
    };
  }

  /**
   * Valida y confirma un pago de WebPay
   */
  async validateWebpayPayment(token: string, subscriptionId?: string): Promise<{
    success: boolean;
    subscription?: UserSubscription;
    redirectUrl?: string;
  }> {
    try {
      // Confirmar y obtener el resultado de la transacción desde WebPay
      const transactionResult = await this.webpayService.commitTransaction(token);

      // La respuesta puede tener diferentes estructuras según la versión del SDK
      // Registrar toda la respuesta para debugging
      console.log('📊 Resultado completo de la transacción WebPay:', JSON.stringify(transactionResult, null, 2));

      // Extraer campos con diferentes nombres posibles (el SDK puede usar snake_case o camelCase)
      const responseCode = transactionResult.responseCode ?? transactionResult.response_code;
      const status = transactionResult.status;
      const buyOrderValue = transactionResult.buyOrder ?? transactionResult.buy_order;
      const amount = transactionResult.amount;
      const authorizationCode = transactionResult.authorizationCode ?? transactionResult.authorization_code;

      console.log('📊 Campos extraídos:', {
        responseCode,
        status,
        buyOrder: buyOrderValue,
        amount,
        authorizationCode,
      });

      // Verificar que la transacción fue exitosa según la documentación de WebPay
      // Debe cumplir: response_code === 0 Y status === 'AUTHORIZED'
      // Si responseCode existe, debe ser 0. Si no existe pero status es AUTHORIZED, también es válido
      if (responseCode !== undefined && responseCode !== 0) {
        throw new BadRequestException(
          `Transacción rechazada. Código de respuesta: ${responseCode}`,
        );
      }

      // El status es el indicador principal
      if (!status || status !== 'AUTHORIZED') {
        throw new BadRequestException(
          `Transacción no autorizada. Estado: ${status || 'DESCONOCIDO'}. ${responseCode !== undefined ? `Código: ${responseCode}` : ''}`,
        );
      }

      console.log('✅ Transacción validada correctamente (status: AUTHORIZED' + (responseCode !== undefined ? `, responseCode: ${responseCode}` : '') + ')');

      // Buscar la suscripción
      let subscription: UserSubscription | null = null;

      if (subscriptionId) {
        subscription = await this.userSubscriptionRepository.findOne({
          where: { id: subscriptionId },
          relations: ['user', 'plan', 'billingCycle'],
        });
      }

      // Si no se encontró por ID, buscar por buyOrder en metadata
      if (!subscription && buyOrderValue) {
        const subscriptions = await this.userSubscriptionRepository.find({
          where: {},
          relations: ['user', 'plan', 'billingCycle'],
        });

        subscription = subscriptions.find(
          (sub) => sub.metadata?.buyOrder === buyOrderValue,
        ) || null;
      }

      if (!subscription) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      // Verificar que el monto coincide
      const expectedAmount = subscription.metadata?.amount;
      const receivedAmount = amount || transactionResult.amount;
      if (expectedAmount && receivedAmount && receivedAmount !== expectedAmount) {
        throw new BadRequestException(`El monto de la transacción no coincide. Esperado: ${expectedAmount}, Recibido: ${receivedAmount}`);
      }

      // Verificar que no haya sido procesada antes
      const transactionId = buyOrderValue || subscription.metadata?.buyOrder;
      const existingPayment = await this.subscriptionPaymentRepository.findOne({
        where: {
          transactionId: transactionId,
          status: PaymentStatus.COMPLETED,
        },
      });

      if (existingPayment) {
        // Ya fue procesada, retornar éxito
        return {
          success: true,
          subscription,
          redirectUrl: `${process.env.APP_URL || 'https://carvajalfit.com'}/club`,
        };
      }

      // Crear registro de pago
      const payment = this.subscriptionPaymentRepository.create({
        userSubscription: subscription,
        user: subscription.user,
        amount: amount || subscription.metadata?.amount || 0,
        currency: subscription.metadata?.currency || 'CLP',
        status: PaymentStatus.COMPLETED,
        paymentMethod: transactionResult.paymentTypeCode || transactionResult.payment_type_code || null,
        paymentProvider: 'webpay',
        transactionId: transactionId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        paidAt: new Date(),
        metadata: {
          webpayResponse: transactionResult,
          authorizationCode: authorizationCode,
          cardNumber: transactionResult.cardDetail?.cardNumber || transactionResult.card_detail?.card_number || null,
        },
      });

      await this.subscriptionPaymentRepository.save(payment);

      // Activar la suscripción
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.metadata = {
        ...subscription.metadata,
        webpayTransactionId: transactionId,
        webpayAuthorizationCode: authorizationCode,
        paymentConfirmedAt: new Date().toISOString(),
      };
      await this.userSubscriptionRepository.save(subscription);

      // Generar boleta electrónica y enviar email de bienvenida con adjunto
      try {
        const boletaPDF = await this.generarBoletaParaPago(subscription, payment);

        const attachments = boletaPDF ? [{
          filename: `boleta-${payment.transactionId || payment.id}.pdf`,
          content: boletaPDF,
          contentType: 'application/pdf',
        }] : undefined;

        await this.marketingService.sendWelcomeEmail(
          subscription.user.email,
          subscription.user.name || subscription.user.email.split('@')[0],
          subscription.plan.name,
          attachments,
        );
      } catch (error) {
        console.error('Error al enviar email de bienvenida:', error);
        // No lanzamos error para no interrumpir el flujo
      }

      // La transacción ya fue confirmada con commitTransaction
      // No necesitamos hacer nada más

      return {
        success: true,
        subscription,
        redirectUrl: transactionResult.urlRedirection || `${process.env.APP_URL || 'https://carvajalfit.com'}/club`,
      };
    } catch (error: any) {
      console.error('Error al validar pago WebPay:', error);
      throw new BadRequestException(
        error.message || 'Error al validar el pago',
      );
    }
  }

  /**
   * Crea una suscripción de PayPal
   */
  async createPayPalSubscription(
    user: User,
    planId: string,
    billingCycleId: string,
    currency?: string,
    subscriptionId?: string,
  ): Promise<{ orderId: string; approveUrl: string; subscriptionId: string }> {
    // 1. Validaciones básicas
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const billingCycle = await this.billingCycleRepository.findOne({
      where: { id: billingCycleId },
    });
    if (!billingCycle) throw new NotFoundException('Ciclo de facturación no encontrado');

    // PayPal requiere USD
    const price = await this.subscriptionPriceRepository.findOne({
      where: {
        plan: { id: plan.id },
        billingCycle: { id: billingCycle.id },
        currency: 'USD',
        isActive: true,
      },
    });

    // Fallback: Si no hay precio en USD, buscar en CLP y convertir
    let paypalAmount = 0;
    if (price) {
      paypalAmount = parseFloat(price.amount.toString());
    } else {
      const priceCLP = await this.subscriptionPriceRepository.findOne({
        where: {
          plan: { id: plan.id },
          billingCycle: { id: billingCycle.id },
          currency: 'CLP',
          isActive: true,
        },
      });
      if (!priceCLP) throw new NotFoundException('Precio no disponible para este plan (USD requerido)');
      // Conversión aproximada si es estrictamente necesario, pero mejor fallar si no está configurado
      // Para este caso, vamos a convertir usando 950 como tasa fija por ahora
      paypalAmount = parseFloat((parseFloat(priceCLP.amount.toString()) / 950).toFixed(2));
      console.log(`⚠️ Usando conversión automática CLP->USD: ${priceCLP.amount} CLP => ${paypalAmount} USD`);
    }

    // Forzar precio en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      paypalAmount = 1;
    }

    // 2. Crear o recuperar suscripción local
    let savedSubscription: UserSubscription;
    if (subscriptionId) {
      const existing = await this.userSubscriptionRepository.findOne({
        where: { id: subscriptionId },
        relations: ['user']
      });
      if (!existing || existing.user.id !== user.id) throw new NotFoundException('Suscripción inválida');

      existing.metadata = {
        ...existing.metadata,
        paymentProvider: 'paypal_subscription',
        currency: 'USD',
      };
      savedSubscription = await this.userSubscriptionRepository.save(existing);
    } else {
      const now = new Date();
      savedSubscription = this.userSubscriptionRepository.create({
        user,
        plan,
        billingCycle,
        status: SubscriptionStatus.PAYMENT_FAILED,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: this.calculatePeriodEnd(now, billingCycle.intervalType, billingCycle.intervalCount),
        autoRenew: true,
        metadata: {
          paymentProvider: 'paypal_subscription',
          currency: 'USD',
        },
      });
      savedSubscription = await this.userSubscriptionRepository.save(savedSubscription);
    }

    // 3. Crear Producto y Plan en PayPal (Dinámico)
    const productName = `Suscripción ${plan.name}`;
    const productDesc = `Acceso al plan ${plan.name} en Carvajal Fit`;

    // Crear producto (siempre se crea uno nuevo para asegurar, o se podría optimizar)
    const productId = await this.paypalService.createProduct(productName, productDesc);

    const intervalUnit = billingCycle.intervalType === 'year' ? 'YEAR' : 'MONTH';

    const planPayPalId = await this.paypalService.createPlan({
      productId,
      name: `${plan.name} - ${billingCycle.name}`,
      description: `Cobro ${billingCycle.name} de ${paypalAmount} USD`,
      amount: paypalAmount,
      currency: 'USD',
      intervalUnit,
      intervalCount: billingCycle.intervalCount,
    });

    // 4. Crear la Suscripción en PayPal
    const appUrl = process.env.APP_URL || 'https://carvajalfit.com';
    const returnUrl = `${appUrl}/checkout/success?subscriptionId=${savedSubscription.id}&paymentProvider=paypal_subscription`;
    const cancelUrl = `${appUrl}/checkout?canceled=true`;

    const ppSubscription = await this.paypalService.createSubscription({
      planId: planPayPalId,
      returnUrl,
      cancelUrl,
      customId: savedSubscription.id,
      userEmail: user.email,
      userFirstName: user.name?.split(' ')[0],
      userLastName: user.name?.split(' ').slice(1).join(' '),
    });

    // 5. Actualizar localmente
    savedSubscription.metadata = {
      ...savedSubscription.metadata,
      paypalSubscriptionId: ppSubscription.id,
      paypalPlanId: planPayPalId,
      amount: paypalAmount,
    };
    await this.userSubscriptionRepository.save(savedSubscription);

    return {
      orderId: ppSubscription.id,
      approveUrl: ppSubscription.approveUrl,
      subscriptionId: savedSubscription.id,
    };
  }

  /**
   * Crea una orden de PayPal para una suscripción
   */
  async createPayPalOrder(
    user: User,
    planId: string,
    billingCycleId: string,
    currency?: string,
    subscriptionId?: string,
  ): Promise<{ orderId: string; approveUrl: string; subscriptionId: string }> {
    // Validar que el plan existe y está activo
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan de suscripción no encontrado o no está activo');
    }

    // Validar que el billing cycle existe
    const billingCycle = await this.billingCycleRepository.findOne({
      where: { id: billingCycleId },
    });

    if (!billingCycle) {
      throw new NotFoundException('Ciclo de facturación no encontrado');
    }

    // Para PayPal, siempre buscar el precio en USD
    // PayPal solo acepta USD, así que debemos usar el precio en USD
    const price = await this.subscriptionPriceRepository.findOne({
      where: {
        plan: { id: plan.id },
        billingCycle: { id: billingCycle.id },
        currency: 'USD', // PayPal siempre usa USD
        isActive: true,
      },
    });

    if (!price) {
      throw new NotFoundException(
        `No se encontró un precio activo en USD para este plan y ciclo de facturación. PayPal requiere precios en USD.`,
      );
    }

    // Verificar si el usuario ya tiene una suscripción activa
    if (!subscriptionId) {
      const existingSubscription = await this.userSubscriptionRepository.findOne({
        where: {
          user: { id: user.id },
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (existingSubscription) {
        throw new BadRequestException('Ya tienes una suscripción activa');
      }
    }

    let savedSubscription: UserSubscription;

    if (subscriptionId) {
      // Usar suscripción existente
      const existing = await this.userSubscriptionRepository.findOne({
        where: { id: subscriptionId },
        relations: ['user']
      });

      if (!existing) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      if (existing.user.id !== user.id) {
        throw new BadRequestException('La suscripción no pertenece al usuario');
      }

      // Actualizar metadata
      existing.metadata = {
        ...existing.metadata,
        paymentProvider: 'paypal',
        currency: 'USD',
        lastPaymentAttempt: new Date().toISOString()
      };

      savedSubscription = await this.userSubscriptionRepository.save(existing);
    } else {
      // Calcular fechas del período
      const now = new Date();
      const periodStart = new Date(now);
      const periodEnd = this.calculatePeriodEnd(now, billingCycle.intervalType, billingCycle.intervalCount);

      // Crear la suscripción en nuestra base de datos (con estado PAYMENT_FAILED hasta confirmar el pago)
      const userSubscription = this.userSubscriptionRepository.create({
        user,
        plan,
        billingCycle,
        status: SubscriptionStatus.PAYMENT_FAILED,
        startedAt: now,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        autoRenew: false, // PayPal no es recurrente por defecto
        metadata: {
          paymentProvider: 'paypal',
          currency: 'USD', // PayPal siempre usa USD
        },
      });

      savedSubscription = await this.userSubscriptionRepository.save(userSubscription);
    }

    // Crear la orden en PayPal
    const appUrl = process.env.APP_URL || 'https://carvajalfit.com';
    const returnUrl = `${appUrl}/checkout/success?subscriptionId=${savedSubscription.id}&paymentProvider=paypal`;
    const cancelUrl = `${appUrl}/checkout?canceled=true`;

    // El precio ya está en USD, usarlo directamente
    let paypalAmount = parseFloat(price.amount.toString());
    const paypalCurrency = 'USD';

    // Forzar precio en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      paypalAmount = 1;
    }

    console.log(`💰 Creando orden PayPal: ${paypalAmount} ${paypalCurrency}`);

    const paypalOrder = await this.paypalService.createOrder({
      amount: paypalAmount,
      currency: paypalCurrency,
      returnUrl,
      cancelUrl,
      description: `Suscripción ${plan.name} - ${billingCycle.name}`,
      customId: savedSubscription.id,
    });

    // Actualizar la suscripción con el orderId de PayPal
    savedSubscription.metadata = {
      ...savedSubscription.metadata,
      paypalOrderId: paypalOrder.id,
      amount: paypalAmount, // Monto en USD
      currency: 'USD',
    };
    await this.userSubscriptionRepository.save(savedSubscription);

    return {
      orderId: paypalOrder.id,
      approveUrl: paypalOrder.approveUrl,
      subscriptionId: savedSubscription.id,
    };
  }

  /**
   * Valida y confirma un pago de PayPal
   */
  async validatePayPalPayment(orderId: string, subscriptionId?: string): Promise<{
    success: boolean;
    subscription?: UserSubscription;
    redirectUrl?: string;
  }> {
    try {
      // Capturar la orden en PayPal
      const captureResult = await this.paypalService.captureOrder(orderId);

      console.log('📊 Resultado de captura PayPal:', JSON.stringify(captureResult, null, 2));

      // Verificar que la orden fue completada exitosamente
      // El status de la orden debe ser COMPLETED
      const orderStatus = captureResult.status;
      if (orderStatus !== 'COMPLETED') {
        throw new BadRequestException(`Pago no completado. Estado de la orden: ${orderStatus}`);
      }

      // Obtener el purchase unit
      const purchaseUnit = captureResult.purchase_units?.[0];
      if (!purchaseUnit) {
        throw new BadRequestException('No se encontró información de la compra en la respuesta de PayPal');
      }

      const payments = purchaseUnit.payments;
      const capture = payments?.captures?.[0];

      if (!capture) {
        throw new BadRequestException('No se encontró información de captura en la respuesta de PayPal');
      }

      // La captura puede estar en PENDING (especialmente en sandbox con PENDING_REVIEW)
      // pero si la orden está COMPLETED, el pago fue aprobado
      const captureStatus = capture.status;
      if (captureStatus !== 'COMPLETED' && captureStatus !== 'PENDING') {
        throw new BadRequestException(
          `La captura del pago no está en un estado válido. Estado: ${captureStatus}${capture.status_details?.reason ? ` (${capture.status_details.reason})` : ''}`
        );
      }

      // Si está PENDING, registrar un warning pero continuar
      if (captureStatus === 'PENDING') {
        console.warn(`⚠️ Captura en estado PENDING: ${capture.status_details?.reason || 'Sin razón especificada'}`);
        console.log('ℹ️ La orden está COMPLETED, por lo que el pago fue aprobado. PayPal notificará cuando la captura se complete.');
      }

      // Buscar la suscripción
      let subscription: UserSubscription | null = null;

      if (subscriptionId) {
        subscription = await this.userSubscriptionRepository.findOne({
          where: { id: subscriptionId },
          relations: ['user', 'plan', 'billingCycle'],
        });
      }

      // Si no se encontró por ID, buscar por orderId en metadata
      if (!subscription) {
        const subscriptions = await this.userSubscriptionRepository.find({
          where: {},
          relations: ['user', 'plan', 'billingCycle'],
        });

        subscription = subscriptions.find(
          (sub) => sub.metadata?.paypalOrderId === orderId,
        ) || null;
      }

      if (!subscription) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      // Verificar que el monto coincide (PayPal siempre retorna USD)
      const expectedAmount = subscription.metadata?.amount;
      const receivedAmount = parseFloat(capture.amount?.value || '0');
      const receivedCurrency = capture.amount?.currency_code || 'USD';

      // Comparar montos en USD
      if (expectedAmount && receivedAmount && Math.abs(receivedAmount - expectedAmount) > 0.01) {
        throw new BadRequestException(
          `El monto de la transacción no coincide. Esperado: ${expectedAmount} USD, Recibido: ${receivedAmount} ${receivedCurrency}`
        );
      }

      console.log(`✅ Monto validado: ${receivedAmount} ${receivedCurrency} (esperado: ${expectedAmount} USD)`);

      // Verificar que no haya sido procesada antes
      const transactionId = capture.id;
      const existingPayment = await this.subscriptionPaymentRepository.findOne({
        where: {
          transactionId: transactionId,
          status: PaymentStatus.COMPLETED,
        },
      });

      if (existingPayment) {
        // Ya fue procesada, retornar éxito
        return {
          success: true,
          subscription,
          redirectUrl: `${process.env.APP_URL || 'https://carvajalfit.com'}/club`,
        };
      }

      // Crear registro de pago
      const payment = this.subscriptionPaymentRepository.create({
        userSubscription: subscription,
        user: subscription.user,
        amount: receivedAmount, // Monto en USD
        currency: 'USD', // PayPal siempre usa USD
        status: PaymentStatus.COMPLETED,
        paymentMethod: 'paypal',
        paymentProvider: 'paypal',
        transactionId: transactionId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        paidAt: new Date(capture.create_time || Date.now()),
        metadata: {
          paypalCapture: capture,
          paypalOrder: captureResult,
          payer: captureResult.payer,
        },
      });

      await this.subscriptionPaymentRepository.save(payment);

      // Activar la suscripción
      // Si la captura está en PENDING, mantener metadata para verificar después
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.metadata = {
        ...subscription.metadata,
        paypalTransactionId: transactionId,
        paypalCaptureId: capture.id,
        paypalOrderId: orderId,
        paypalCaptureStatus: captureStatus,
        paymentConfirmedAt: new Date().toISOString(),
        // Si está PENDING, guardar info para verificar después
        ...(captureStatus === 'PENDING' && {
          paypalPendingReason: capture.status_details?.reason,
          needsCaptureVerification: true,
        }),
      };
      await this.userSubscriptionRepository.save(subscription);

      // Generar boleta electrónica y enviar email de bienvenida con adjunto
      try {
        const boletaPDF = await this.generarBoletaParaPago(subscription, payment);

        const attachments = boletaPDF ? [{
          filename: `boleta-${payment.transactionId || payment.id}.pdf`,
          content: boletaPDF,
          contentType: 'application/pdf',
        }] : undefined;

        await this.marketingService.sendWelcomeEmail(
          subscription.user.email,
          subscription.user.name || subscription.user.email.split('@')[0],
          subscription.plan.name,
          attachments,
        );
      } catch (error) {
        console.error('Error al enviar email de bienvenida PayPal:', error);
        // No lanzamos error para no interrumpir el flujo
      }

      return {
        success: true,
        subscription,
        redirectUrl: `${process.env.APP_URL || 'https://carvajalfit.com'}/club`,
      };
    } catch (error: any) {
      console.error('Error al validar pago PayPal:', error);
      throw new BadRequestException(
        error.message || 'Error al validar el pago',
      );
    }
  }

  /**
   * Verifica el estado actual de una captura de PayPal
   * Útil para verificar capturas que quedaron en PENDING
   */
  async verifyPayPalCapture(captureId: string): Promise<{
    status: string;
    capture: any;
  }> {
    try {
      const captureDetails = await this.paypalService.getCaptureDetails(captureId);

      return {
        status: captureDetails.status,
        capture: captureDetails,
      };
    } catch (error: any) {
      console.error('Error al verificar captura PayPal:', error);
      throw new BadRequestException(
        error.message || 'Error al verificar la captura',
      );
    }
  }

  /**
   * Crea un checkout de Mercado Pago (nueva API - Checkout Pro)
   */
  async createMercadoPagoCheckout(
    user: User,
    planId: string,
    billingCycleId: string,
    currency?: string,
    subscriptionId?: string,
  ): Promise<{ preferenceId: string; initPoint: string; subscriptionId: string }> {
    // Validar que el plan existe y está activo
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan de suscripción no encontrado o no está activo');
    }

    // Validar que el billing cycle existe
    const billingCycle = await this.billingCycleRepository.findOne({
      where: { id: billingCycleId },
    });

    if (!billingCycle) {
      throw new NotFoundException('Ciclo de facturación no encontrado');
    }

    // Obtener el precio del plan
    const finalCurrency = currency || user.preferredCurrency || 'CLP';
    const price = await this.subscriptionPriceRepository.findOne({
      where: {
        plan: { id: plan.id },
        billingCycle: { id: billingCycle.id },
        currency: finalCurrency,
        isActive: true,
      },
    });

    if (!price) {
      throw new NotFoundException(
        `No se encontró un precio activo para este plan, ciclo de facturación y moneda (${finalCurrency})`,
      );
    }

    // Verificar si el usuario ya tiene una suscripción activa
    if (!subscriptionId) {
      const existingSubscription = await this.userSubscriptionRepository.findOne({
        where: {
          user: { id: user.id },
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (existingSubscription) {
        throw new BadRequestException('Ya tienes una suscripción activa');
      }
    }

    let savedSubscription: UserSubscription;

    if (subscriptionId) {
      // Usar suscripción existente
      const existing = await this.userSubscriptionRepository.findOne({
        where: { id: subscriptionId },
        relations: ['user']
      });

      if (!existing) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      if (existing.user.id !== user.id) {
        throw new BadRequestException('La suscripción no pertenece al usuario');
      }

      // Actualizar metadata
      existing.metadata = {
        ...existing.metadata,
        paymentProvider: 'mercadopago_checkout',
        currency: finalCurrency,
        lastPaymentAttempt: new Date().toISOString()
      };

      savedSubscription = await this.userSubscriptionRepository.save(existing);
    } else {
      // Calcular fechas del período
      const now = new Date();
      const periodStart = new Date(now);
      const periodEnd = this.calculatePeriodEnd(now, billingCycle.intervalType, billingCycle.intervalCount);

      // Crear la suscripción en nuestra base de datos (con estado PAYMENT_FAILED hasta confirmar el pago)
      const userSubscription = this.userSubscriptionRepository.create({
        user,
        plan,
        billingCycle,
        status: SubscriptionStatus.PAYMENT_FAILED,
        startedAt: now,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        autoRenew: false, // Checkout Pro es pago único
        metadata: {
          paymentProvider: 'mercadopago_checkout',
          currency: finalCurrency,
        },
      });

      savedSubscription = await this.userSubscriptionRepository.save(userSubscription);
    }

    // Crear la preferencia de pago en Mercado Pago
    const appUrl = process.env.APP_URL || 'https://carvajalfit.com';
    const returnUrl = `${appUrl}/checkout/success?subscriptionId=${savedSubscription.id}&paymentProvider=mercadopago`;
    const cancelUrl = `${appUrl}/checkout?canceled=true`;

    let amount = parseFloat(price.amount.toString());

    // Forzar precio en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      amount = 950;
    }

    const preference = await this.mercadoPagoCheckoutService.createPaymentPreference({
      amount,
      currency: finalCurrency,
      description: `Suscripción ${plan.name} - ${billingCycle.name}`,
      externalReference: savedSubscription.id,
      returnUrl,
      cancelUrl,
      payerEmail: user.email,
      payerName: user.name || undefined,
    });

    // Actualizar la suscripción con el preferenceId de Mercado Pago
    savedSubscription.metadata = {
      ...savedSubscription.metadata,
      mercadoPagoPreferenceId: preference.id,
      amount,
    };
    await this.userSubscriptionRepository.save(savedSubscription);

    return {
      preferenceId: preference.id,
      initPoint: preference.sandboxInitPoint || preference.initPoint,
      subscriptionId: savedSubscription.id,
    };
  }

  /**
   * Valida y confirma un pago de Mercado Pago Checkout
   */
  async validateMercadoPagoPayment(paymentId: string, subscriptionId?: string): Promise<{
    success: boolean;
    subscription?: UserSubscription;
    redirectUrl?: string;
  }> {
    try {
      // Obtener información del pago desde Mercado Pago
      const payment = await this.mercadoPagoCheckoutService.getPayment(paymentId);

      console.log('📊 Resultado de pago Mercado Pago:', JSON.stringify(payment, null, 2));

      // Verificar que el pago fue aprobado
      const status = payment.status;
      if (status !== 'approved') {
        throw new BadRequestException(`Pago no aprobado. Estado: ${status}`);
      }

      // Buscar la suscripción
      let subscription: UserSubscription | null = null;

      if (subscriptionId) {
        subscription = await this.userSubscriptionRepository.findOne({
          where: { id: subscriptionId },
          relations: ['user', 'plan', 'billingCycle'],
        });
      }

      // Si no se encontró por ID, buscar por external_reference en el pago
      if (!subscription && payment.external_reference) {
        subscription = await this.userSubscriptionRepository.findOne({
          where: { id: payment.external_reference },
          relations: ['user', 'plan', 'billingCycle'],
        });
      }

      // Si no se encontró, buscar por preference_id en metadata
      if (!subscription && payment.preference_id) {
        const subscriptions = await this.userSubscriptionRepository.find({
          where: {},
          relations: ['user', 'plan', 'billingCycle'],
        });

        subscription = subscriptions.find(
          (sub) => sub.metadata?.mercadoPagoPreferenceId === payment.preference_id,
        ) || null;
      }

      if (!subscription) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      // Verificar que el monto coincide
      const expectedAmount = subscription.metadata?.amount;
      const receivedAmount = payment.transaction_amount;
      if (expectedAmount && receivedAmount && Math.abs(receivedAmount - expectedAmount) > 0.01) {
        throw new BadRequestException(
          `El monto de la transacción no coincide. Esperado: ${expectedAmount}, Recibido: ${receivedAmount}`
        );
      }

      console.log(`✅ Monto validado: ${receivedAmount} ${payment.currency_id} (esperado: ${expectedAmount})`);

      // Verificar que no haya sido procesada antes
      const transactionId = payment.id?.toString();
      const existingPayment = await this.subscriptionPaymentRepository.findOne({
        where: {
          transactionId: transactionId,
          status: PaymentStatus.COMPLETED,
        },
      });

      if (existingPayment) {
        // Ya fue procesada, retornar éxito
        return {
          success: true,
          subscription,
          redirectUrl: `${process.env.APP_URL || 'https://carvajalfit.com'}/club`,
        };
      }

      // Crear registro de pago
      const paymentRecord = this.subscriptionPaymentRepository.create({
        userSubscription: subscription,
        user: subscription.user,
        amount: receivedAmount,
        currency: payment.currency_id || subscription.metadata?.currency || 'CLP',
        status: PaymentStatus.COMPLETED,
        paymentMethod: payment.payment_method_id || null,
        paymentProvider: 'mercadopago_checkout',
        transactionId: transactionId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
        metadata: {
          mercadoPagoPayment: payment,
          paymentType: payment.payment_type_id,
        },
      });

      await this.subscriptionPaymentRepository.save(paymentRecord);

      // Activar la suscripción
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.metadata = {
        ...subscription.metadata,
        mercadoPagoPaymentId: transactionId,
        mercadoPagoPreferenceId: payment.preference_id,
        paymentConfirmedAt: new Date().toISOString(),
      };
      await this.userSubscriptionRepository.save(subscription);

      // Generar boleta electrónica y enviar email de bienvenida con adjunto
      try {
        const boletaPDF = await this.generarBoletaParaPago(subscription, paymentRecord);

        const attachments = boletaPDF ? [{
          filename: `boleta-${paymentRecord.transactionId || paymentRecord.id}.pdf`,
          content: boletaPDF,
          contentType: 'application/pdf',
        }] : undefined;

        await this.marketingService.sendWelcomeEmail(
          subscription.user.email,
          subscription.user.name || subscription.user.email.split('@')[0],
          subscription.plan.name,
          attachments,
        );
      } catch (error) {
        console.error('Error al enviar email de bienvenida:', error);
        // No lanzamos error para no interrumpir el flujo
      }

      return {
        success: true,
        subscription,
        redirectUrl: `${process.env.APP_URL || 'https://carvajalfit.com'}/club`,
      };
    } catch (error: any) {
      console.error('Error al validar pago Mercado Pago:', error);
      throw new BadRequestException(
        error.message || 'Error al validar el pago',
      );
    }
  }

  /**
   * Valida una suscripción de Mercado Pago (Preapproval)
   */
  async validateMercadoPagoSubscription(preapprovalId: string): Promise<{
    success: boolean;
    subscription?: UserSubscription;
    redirectUrl?: string;
  }> {
    try {
      // Obtener información de la suscripción desde Mercado Pago
      const mpSubscription = await this.mercadoPagoService.getSubscription(preapprovalId);

      console.log('📊 Resultado de suscripción Mercado Pago:', JSON.stringify(mpSubscription, null, 2));

      // Buscar la suscripción local por mercadoPagoSubscriptionId o external_reference
      let subscription = await this.userSubscriptionRepository.findOne({
        where: [
          { mercadoPagoSubscriptionId: preapprovalId },
          { id: mpSubscription.external_reference }
        ],
        relations: ['user', 'plan', 'billingCycle'],
      });

      if (!subscription) {
        throw new NotFoundException('Suscripción local no encontrada');
      }

      // Asegurar que el ID de MP esté guardado
      if (!subscription.mercadoPagoSubscriptionId) {
        subscription.mercadoPagoSubscriptionId = preapprovalId;
      }

      // Si el estado es autorizado o activo, actualizar localmente
      if (mpSubscription.status === 'authorized' || mpSubscription.status === 'active') {
        subscription.status = SubscriptionStatus.ACTIVE;
        await this.userSubscriptionRepository.save(subscription);
      }

      return {
        success: mpSubscription.status === 'authorized' || mpSubscription.status === 'active',
        subscription,
        redirectUrl: `${process.env.APP_URL || 'https://carvajalfit.com'}/club`,
      };
    } catch (error: any) {
      console.error('Error al validar suscripción de Mercado Pago:', error.message);
      return {
        success: false,
        redirectUrl: `${process.env.APP_URL || 'https://carvajalfit.com'}/checkout?error=mp_subscription_failed`,
      };
    }
  }

  /**
   * Maneja los webhooks de PayPal
   */
  async handlePayPalWebhook(body: any) {
    const eventType = body.event_type;
    const resource = body.resource;

    console.log(`🔔 Webhook PayPal recibido: ${eventType}`, JSON.stringify(resource?.id));

    // Identificar ID de suscripción
    let paypalSubscriptionId = resource.id;

    // Para eventos de pago, el ID de suscripción suele venir en billing_agreement_id
    if (eventType === 'PAYMENT.SALE.COMPLETED' || eventType === 'PAYMENT.SALE.DENIED') {
      paypalSubscriptionId = resource.billing_agreement_id;
    }

    if (!paypalSubscriptionId) {
      console.warn('⚠️ Webhook PayPal sin ID de suscripción identificable');
      return;
    }

    // Buscar suscripción en DB
    // Nota: Buscar en metadata->paypalSubscriptionId
    const subscriptions = await this.userSubscriptionRepository.find({
      relations: ['user', 'plan', 'billingCycle'],
    });

    // Filtro en memoria porque está en JSONB (podría optimizarse con query builder)
    const subscription = subscriptions.find(
      (sub) => sub.metadata?.paypalSubscriptionId === paypalSubscriptionId
    );

    if (!subscription) {
      console.warn(`⚠️ Suscripción no encontrada para ID PayPal: ${paypalSubscriptionId}`);
      return;
    }

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.handlePayPalSubscriptionActivated(subscription, resource);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        await this.handlePayPalPaymentCompleted(subscription, resource);
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await this.handlePayPalPaymentFailed(subscription, resource);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await this.handlePayPalSubscriptionCancelled(subscription, resource);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await this.handlePayPalSubscriptionSuspended(subscription, resource);
        break;
    }
  }

  private async handlePayPalSubscriptionActivated(subscription: UserSubscription, resource: any) {
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.startedAt = new Date(resource.start_time || new Date());
      subscription.metadata = {
        ...subscription.metadata,
        paypalStatus: resource.status,
        lastWebhookEvent: 'BILLING.SUBSCRIPTION.ACTIVATED',
      };
      await this.userSubscriptionRepository.save(subscription);

      // Enviar email de bienvenida si es primera activación
      // (aunque normalmente lo hacemos al confirmar el primer pago en validatePayPalPayment/handlePayPalPaymentCompleted)
    }
  }

  private async handlePayPalPaymentCompleted(subscription: UserSubscription, resource: any) {
    const amount = resource.amount?.total || resource.amount?.value;
    const currency = resource.amount?.currency || 'USD';
    const transactionId = resource.id;

    console.log(`✅ Pago recurrente PayPal completado: ${amount} ${currency}`);

    // Verificar si ya existe el pago
    const existingPayment = await this.subscriptionPaymentRepository.findOne({
      where: { transactionId, paymentProvider: 'paypal_subscription' }
    });

    if (existingPayment) return;

    // Calcular nuevo período si es necesario
    // PayPal actualiza el next_billing_time en el recurso de suscripción, pero aquí tenemos el recurso de PAGO.
    // Lo ideal es consultar la suscripción a PayPal para obtener las fechas exactas, 
    // o sumar el intervalo manualmente.

    // Por simplicidad, extendemos el periodo desde "ahora" o desde el final anterior
    const now = new Date();
    let newPeriodStart = subscription.currentPeriodEnd;

    // Si la suscripción estaba vencida, reiniciar desde hoy
    if (newPeriodStart < now) {
      newPeriodStart = now;
    }

    const newPeriodEnd = this.calculatePeriodEnd(
      newPeriodStart,
      subscription.billingCycle.intervalType,
      subscription.billingCycle.intervalCount
    );

    // Registrar pago
    const payment = this.subscriptionPaymentRepository.create({
      userSubscription: subscription,
      user: subscription.user,
      amount: parseFloat(amount),
      currency,
      status: PaymentStatus.COMPLETED,
      paymentMethod: 'paypal_subscription',
      paymentProvider: 'paypal_subscription',
      transactionId,
      periodStart: newPeriodStart,
      periodEnd: newPeriodEnd,
      paidAt: new Date(resource.create_time || now),
      metadata: {
        paypalResource: resource,
        isRecurring: true,
      },
    });

    await this.subscriptionPaymentRepository.save(payment);

    // Actualizar suscripción
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.currentPeriodStart = newPeriodStart;
    subscription.currentPeriodEnd = newPeriodEnd;
    subscription.metadata = {
      ...subscription.metadata,
      lastPaymentDate: new Date().toISOString(),
      paypalStatus: 'ACTIVE', // Asumimos activa si pagó
    };

    await this.userSubscriptionRepository.save(subscription);

    // Generar boleta electrónica
    let attachments: any[] = [];
    try {
      const boletaPDF = await this.generarBoletaParaPago(subscription, payment);
      if (boletaPDF) {
        attachments.push({
          filename: `boleta-${transactionId}.pdf`,
          content: boletaPDF,
          contentType: 'application/pdf',
        });
      }
    } catch (error) {
      console.error('Error al generar boleta PayPal recurrente:', error);
    }

    // Enviar email de éxito
    await this.marketingService.sendSubscriptionPaymentSuccessEmail(
      subscription.user.email,
      subscription.user.name || 'Usuario',
      subscription.plan.name,
      typeof amount === 'string' ? parseFloat(amount) : amount,
      newPeriodEnd,
      attachments
    );
  }

  private async handlePayPalPaymentFailed(subscription: UserSubscription, resource: any) {
    console.warn(`❌ Pago fallido PayPal para suscripción ${subscription.id}`);

    // Podríamos marcar como PAYMENT_FAILED o esperar reintento
    // PayPal reintenta automáticamente según configuración del Plan.

    subscription.status = SubscriptionStatus.PAYMENT_FAILED;
    await this.userSubscriptionRepository.save(subscription);

    await this.marketingService.sendSubscriptionPaymentFailedEmail(
      subscription.user.email,
      subscription.user.name || 'Usuario',
      subscription.plan.name,
      `${process.env.APP_URL}/checkout` // Link para actualizar pago
    );
  }

  private async handlePayPalSubscriptionCancelled(subscription: UserSubscription, resource: any) {
    console.log(`⚠️ Suscripción PayPal cancelada: ${subscription.id}`);

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = 'Cancelado en PayPal';

    await this.userSubscriptionRepository.save(subscription);
  }

  private async handlePayPalSubscriptionSuspended(subscription: UserSubscription, resource: any) {
    console.log(`⚠️ Suscripción PayPal suspendida: ${subscription.id}`);
    subscription.status = SubscriptionStatus.PAYMENT_FAILED; // O SUSPENDED si existiera
    await this.userSubscriptionRepository.save(subscription);
  }

  /**
   * Migración de suscriptores
   */
  async migrateSubscribers(
    data: any[],
  ): Promise<{ processed: number; success: number; failed: number; errors: any[] }> {
    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    // Validar que data sea un array
    if (!Array.isArray(data)) {
      throw new BadRequestException('El formato de datos debe ser una lista de suscriptores');
    }

    // Obtener plan por defecto (mensual) si no se especifica
    const defaultPlan = await this.subscriptionPlanRepository.findOne({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    if (!defaultPlan) {
      throw new Error('No hay planes activos para asignar a los usuarios migrados');
    }

    const defaultBillingCycle = await this.billingCycleRepository.findOne({
      where: { slug: 'mensual' }
    });

    if (!defaultBillingCycle) {
      throw new Error('No se encontró el ciclo de facturación mensual por defecto');
    }

    for (const item of data) {
      processed++;
      try {
        const { email, name, status, startDate, lastActivationDate, planName } = item;

        if (!email) {
          throw new Error('Email es requerido');
        }

        // 1. Buscar o crear usuario
        let user = await this.userRepository.findOne({ where: { email } });
        let isNewUser = false;

        if (!user) {
          isNewUser = true;
          // Crear usuario con password temporal (aunque no se usará porque se pedirá reset)
          // Generamos un hash aleatorio para seguridad
          const randomPass = Math.random().toString(36).slice(-8);
          // Usamos un hash dummy, el usuario DEBE restablecerlo
          user = this.userRepository.create({
            email,
            name: name || undefined,
            role: UserRole.CUSTOMER,
            passwordHash: '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXe',
            status: UserStatus.ACTIVE,
          });

          user = await this.userRepository.save(user);
        }

        // 2. Crear/Actualizar Suscripción
        let subscription = await this.userSubscriptionRepository.findOne({
          where: { user: { id: user.id } },
          order: { createdAt: 'DESC' }
        });

        if (!subscription) {
          // Determinar plan (por nombre o default)
          let plan = defaultPlan;
          if (planName) {
            const foundPlan = await this.subscriptionPlanRepository.findOne({
              where: { name: planName }
            });
            if (foundPlan) plan = foundPlan;
          }

          // Crear suscripción
          const start = startDate ? new Date(startDate) : new Date();
          let currentPeriodStart = lastActivationDate ? new Date(lastActivationDate) : new Date();

          // Si la fecha de última activación es inválida o muy antigua, usar start
          if (isNaN(currentPeriodStart.getTime())) currentPeriodStart = start;

          // Calcular fin del periodo
          const billingCycleToUse = defaultBillingCycle;
          const intervalType = billingCycleToUse?.intervalType || 'month';
          const intervalCount = billingCycleToUse?.intervalCount || 1;

          const currentPeriodEnd = this.calculatePeriodEnd(currentPeriodStart, intervalType, intervalCount);

          // Map status
          let subStatus = SubscriptionStatus.ACTIVE;
          if (status === 'cancelled') subStatus = SubscriptionStatus.CANCELLED;
          if (status === 'paused') subStatus = SubscriptionStatus.PAUSED;

          subscription = this.userSubscriptionRepository.create({
            user,
            plan,
            billingCycle: billingCycleToUse,
            status: subStatus,
            startedAt: start,
            currentPeriodStart,
            currentPeriodEnd,
            autoRenew: subStatus === SubscriptionStatus.ACTIVE,
            metadata: {
              migrated: true,
              migrationDate: new Date().toISOString(),
              originalStatus: status,
            }
          });

          await this.userSubscriptionRepository.save(subscription);
        }

        success++;
      } catch (err: any) {
        failed++;
        errors.push({ email: item.email, error: err.message });
      }
    }

    return { processed, success, failed, errors };
  }

  async migrateJsonSubscribers(
    data: any[],
  ): Promise<{ processed: number; success: number; failed: number; errors: any[] }> {
    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    if (!Array.isArray(data)) {
      throw new BadRequestException('El formato de datos debe ser una lista de suscriptores');
    }

    const defaultPlan = await this.subscriptionPlanRepository.findOne({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    if (!defaultPlan) {
      throw new Error('No hay planes activos para asignar a los usuarios migrados');
    }

    const defaultBillingCycle = await this.billingCycleRepository.findOne({
      where: { slug: 'mensual' },
    });

    if (!defaultBillingCycle) {
      throw new Error('No se encontró el ciclo de facturación mensual por defecto');
    }

    for (const item of data) {
      processed++;
      try {
        const email = item.member_email;
        if (!email) {
          throw new Error('Email (member_email) es requerido');
        }

        // 1. Buscar o crear usuario
        let user = await this.userRepository.findOne({ where: { email } });

        if (!user) {
          const firstName = item.member_first_name || '';
          const lastName = item.member_last_name || item.user_name || '';
          const fullName = `${firstName} ${lastName}`.trim();

          user = this.userRepository.create({
            email,
            name: fullName || email.split('@')[0],
            role: UserRole.CUSTOMER,
            passwordHash: '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXe',
            status: UserStatus.ACTIVE,
          });

          user = await this.userRepository.save(user);
        }

        // 2. Verificar si ya tiene suscripción (Requerimiento: "solo agrega")
        const existingSubscription = await this.userSubscriptionRepository.findOne({
          where: {
            user: { id: user.id },
            status: SubscriptionStatus.ACTIVE,
          },
        });

        if (existingSubscription) {
          throw new Error(`El usuario ya tiene una suscripción activa.`);
        }

        // 3. Crear Suscripción
        const startDateString = item.member_since || new Date().toISOString();
        const start = new Date(startDateString);
        let currentPeriodStart = start;

        // Si hay expiración en el JSON, intentar usarla
        let currentPeriodEnd: Date;
        if (item.membership_expiration) {
          currentPeriodEnd = new Date(item.membership_expiration);
          if (isNaN(currentPeriodEnd.getTime())) {
            currentPeriodEnd = this.calculatePeriodEnd(
              currentPeriodStart,
              defaultBillingCycle.intervalType,
              defaultBillingCycle.intervalCount,
            );
          }
        } else {
          currentPeriodEnd = this.calculatePeriodEnd(
            currentPeriodStart,
            defaultBillingCycle.intervalType,
            defaultBillingCycle.intervalCount,
          );
        }

        // Map status (Homologación)
        let subStatus = SubscriptionStatus.ACTIVE;
        const oldStatus = (item.membership_status || '').toLowerCase();

        if (oldStatus === 'cancelled') subStatus = SubscriptionStatus.CANCELLED;
        else if (oldStatus === 'paused') subStatus = SubscriptionStatus.PAUSED;
        else if (oldStatus === 'active') subStatus = SubscriptionStatus.ACTIVE;
        else if (oldStatus === 'expired') subStatus = SubscriptionStatus.EXPIRED;
        // Si no existe el estado, se mantiene ACTIVE (homologado) como sugerido
        // El requerimiento dice "si no existe el estado homologa a mi sistema si no creamos un nuevo estado"
        // Como no podemos crear estados en el Enum dinámicamente sin cambios de código, 
        // asumimos que los conocidos se mapean y los desconocidos se homologan a ACTIVE.

        const subscription = this.userSubscriptionRepository.create({
          user,
          plan: defaultPlan,
          billingCycle: defaultBillingCycle,
          status: subStatus,
          startedAt: start,
          currentPeriodStart,
          currentPeriodEnd,
          autoRenew: subStatus === SubscriptionStatus.ACTIVE,
          metadata: {
            migrated: true,
            migrationDate: new Date().toISOString(),
            originalJson: item,
            source: 'old_system_migration_json',
          },
        });

        await this.userSubscriptionRepository.save(subscription);

        success++;
      } catch (err: any) {
        failed++;
        errors.push({ email: item.member_email || item.user_name || 'unknown', error: err.message });
      }
    }

    return { processed, success, failed, errors };
  }

  async getAllMercadoPagoSubscriptions(query: any) {
    return this.mercadoPagoService.searchSubscriptions(query);
  }
}
