import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, PreApproval, Payment } from 'mercadopago';

export interface CreateSubscriptionData {
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingCycleSlug: string;
  intervalType: string;
  intervalCount: number;
  payerEmail: string;
  paymentMethodId: string | null;
  payerFirstName?: string;
  payerLastName?: string;
  payerIdentificationType?: string;
  payerIdentificationNumber?: string;
  externalReference: string;
  backUrl?: string;
}

@Injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig;
  private preApproval: PreApproval;
  private payment: Payment;

  constructor(private configService: ConfigService) {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado en las variables de entorno');
    }

    this.client = new MercadoPagoConfig({
      accessToken: accessToken,
      options: {
        timeout: 5000,
        idempotencyKey: 'abc',
      },
    });

    this.preApproval = new PreApproval(this.client);
    this.payment = new Payment(this.client);
  }

  async createSubscription(data: CreateSubscriptionData) {
    try {
      // Mapear intervalType a frequency_type de Mercado Pago
      const frequencyType = this.mapIntervalTypeToFrequencyType(data.intervalType);
      
      // Calcular fecha de inicio (mañana a las 00:00:00 para asegurar que sea válida)
      // Mercado Pago requiere que la fecha esté en formato ISO 8601 completo
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // Al menos un día en el futuro
      startDate.setHours(0, 0, 0, 0);
      
      // Calcular fecha de fin (opcional, puedes dejarlo null para suscripción indefinida)
      // Por ahora lo dejamos indefinido
      const endDate = null;

      // Ajustar frecuencia para semanas y años
      let adjustedFrequency = data.intervalCount;
      if (data.intervalType === 'week') {
        adjustedFrequency = data.intervalCount * 7; // Convertir semanas a días
      } else if (data.intervalType === 'year') {
        adjustedFrequency = data.intervalCount * 12; // Convertir años a meses
      }

      // Construir el objeto de suscripción según la API de Mercado Pago
      const subscriptionData: any = {
        reason: data.planName,
        external_reference: data.externalReference,
        payer_email: data.payerEmail,
        auto_recurring: {
          frequency: adjustedFrequency,
          frequency_type: frequencyType,
          start_date: startDate.toISOString(), // Formato ISO 8601 completo: YYYY-MM-DDTHH:MM:SS.sssZ
          transaction_amount: data.amount,
          currency_id: data.currency,
        },
        back_url: data.backUrl || `${this.configService.get<string>('APP_URL', 'http://localhost:3000')}/subscriptions/callback`,
      };

      // Si hay fecha de fin, agregarla en formato ISO 8601
      if (endDate) {
        subscriptionData.auto_recurring.end_date = endDate instanceof Date ? endDate.toISOString() : endDate;
      }

      // Agregar información del pagador si está disponible
      if (data.payerFirstName || data.payerLastName) {
        subscriptionData['payer'] = {
          name: data.payerFirstName,
          surname: data.payerLastName,
        };
      }

      if (data.payerIdentificationType && data.payerIdentificationNumber) {
        if (!subscriptionData['payer']) {
          subscriptionData['payer'] = {};
        }
        subscriptionData['payer']['identification'] = {
          type: data.payerIdentificationType,
          number: data.payerIdentificationNumber,
        };
      }

      const response = await this.preApproval.create({ body: subscriptionData });

      return {
        id: response.id,
        status: response.status,
        initPoint: response.init_point,
        sandboxInitPoint: (response as any).sandbox_init_point || null,
        externalReference: response.external_reference,
        payerEmail: response.payer_email,
        reason: response.reason,
        autoRecurring: response.auto_recurring,
      };
    } catch (error) {
      console.error('Error creando suscripción en Mercado Pago:', error);
      throw new BadRequestException(
        `Error al crear la suscripción en Mercado Pago: ${error.message}`,
      );
    }
  }

  async getSubscription(subscriptionId: string) {
    try {
      const response = await this.preApproval.get({ id: subscriptionId });
      return response;
    } catch (error) {
      console.error('Error obteniendo suscripción de Mercado Pago:', error);
      throw new BadRequestException(
        `Error al obtener la suscripción de Mercado Pago: ${error.message}`,
      );
    }
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const response = await this.preApproval.update({
        id: subscriptionId,
        body: {
          status: 'cancelled',
        },
      });
      return response;
    } catch (error) {
      console.error('Error cancelando suscripción en Mercado Pago:', error);
      throw new BadRequestException(
        `Error al cancelar la suscripción en Mercado Pago: ${error.message}`,
      );
    }
  }

  async getPayment(paymentId: string) {
    try {
      const response = await this.payment.get({ id: paymentId });
      return response;
    } catch (error) {
      console.error('Error obteniendo pago de Mercado Pago:', error);
      throw new BadRequestException(
        `Error al obtener el pago de Mercado Pago: ${error.message}`,
      );
    }
  }

  private mapIntervalTypeToFrequencyType(intervalType: string): 'days' | 'months' {
    switch (intervalType.toLowerCase()) {
      case 'day':
        return 'days';
      case 'week':
        // Mercado Pago no soporta semanas directamente, convertir a días
        return 'days';
      case 'month':
        return 'months';
      case 'year':
        // Mercado Pago no soporta años directamente, usar meses
        return 'months';
      default:
        return 'months';
    }
  }
}

