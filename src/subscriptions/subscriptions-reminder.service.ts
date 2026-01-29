import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserSubscription, SubscriptionStatus } from '../database/entities/user-subscriptions.entity';
import { SubscriptionPayment, PaymentStatus } from '../database/entities/subscription-payments.entity';
import { MarketingService } from '../marketing/marketing.service';
import { ConfigService } from '@nestjs/config';
import { getSubscriptionReminderTemplate } from './subscription-email-templates';
import { MercadoPagoService } from './mercado-pago.service';

@Injectable()
export class SubscriptionsReminderService {
    private readonly logger = new Logger(SubscriptionsReminderService.name);

    constructor(
        @InjectRepository(UserSubscription)
        private readonly userSubscriptionRepository: Repository<UserSubscription>,
        @InjectRepository(SubscriptionPayment)
        private readonly subscriptionPaymentRepository: Repository<SubscriptionPayment>,
        private readonly marketingService: MarketingService,
        private readonly configService: ConfigService,
        private readonly mercadoPagoService: MercadoPagoService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleSubscriptionMaintenance() {
        this.logger.log('Iniciando mantenimiento diario de suscripciones...');

        await this.processReminders();

        this.logger.log('Mantenimiento diario de suscripciones completado.');
    }

    private async processReminders() {
        const now = new Date();
        const appUrl = this.configService.get<string>('APP_URL') || 'https://carvajalfit.com';

        // 1. Obtener todas las suscripciones activas que vencen pronto o ya vencieron
        // Buscamos activas y aquellas con fallos de pago que aún no han sido suspendidas
        const subscriptions = await this.userSubscriptionRepository.find({
            where: {
                status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAYMENT_FAILED]),
            },
            relations: ['user'],
        });

        for (const sub of subscriptions) {
            try {
                const diffInTime = sub.currentPeriodEnd.getTime() - now.getTime();
                const diffInDays = Math.ceil(diffInTime / (1000 * 3600 * 24));

                // Obtener el último pago pendiente o fallido para incluir el link
                const lastPayment = await this.subscriptionPaymentRepository.findOne({
                    where: {
                        userSubscription: { id: sub.id },
                        status: In([PaymentStatus.PENDING, PaymentStatus.FAILED]),
                    },
                    order: { createdAt: 'DESC' },
                });

                const paymentLink = `${appUrl}/payment/${lastPayment?.id || sub.id}`;

                // Lógica de recordatorios:
                // - 1 día antes del vencimiento (diffInDays === 1)
                // - El día del vencimiento (diffInDays === 0)
                // - Cada día depués hasta 5 veces (diffInDays === -1, -2, -3, -4, -5)

                let shouldSendEmail = false;
                let isExpired = diffInDays <= 0;
                let isSuspended = false;
                let daysToWait = Math.abs(diffInDays);

                if (diffInDays === 1) {
                    // Solo log para monitoreo si se desea, o dejar vacío
                    // this.logger.log(`Vencimiento en 1 día para: ${sub.user.email}`);
                } else if (diffInDays === 0) {
                    // this.logger.log(`Vencimiento hoy para: ${sub.user.email}`);
                } else if (diffInDays < 0 && diffInDays >= -5) {
                    // this.logger.log(`${daysToWait} día(s) después del vencimiento para: ${sub.user.email}`);

                    // Si llegamos al límite de 5 veces (diffInDays === -5), suspender
                    if (diffInDays === -5) {
                        isSuspended = true;
                        sub.status = SubscriptionStatus.PAYMENT_FAILED; // O EXPIRED si prefieres

                        // Cancelar también en Mercado Pago para detener intentos de cobro
                        if (sub.mercadoPagoSubscriptionId) {
                            try {
                                await this.mercadoPagoService.cancelSubscription(sub.mercadoPagoSubscriptionId);
                                this.logger.log(`Suscripción de MP ${sub.mercadoPagoSubscriptionId} cancelada exitosamente.`);
                            } catch (error) {
                                this.logger.error(`Error cancelando suscripción MP ${sub.mercadoPagoSubscriptionId}: ${error.message}`);
                            }
                        }

                        // Podríamos añadir una propiedad 'metadata' para marcar que fue suspendida por falta de pago
                        sub.metadata = { ...sub.metadata, suspendedForNonPayment: true, suspensionDate: now.toISOString() };
                        await this.userSubscriptionRepository.save(sub);
                    }
                }

                if (isSuspended) {
                    this.logger.warn(`Suscripción de ${sub.user.email} suspendida por falta de pago.`);
                }
            } catch (error) {
                this.logger.error(`Error procesando suscripción ${sub.id}: ${error.message}`);
            }
        }
    }
}
