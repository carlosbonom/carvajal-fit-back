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
      // Mercado Pago requiere que la fecha esté en formato ISO 8601
      // Algunas versiones de la API requieren solo la fecha (YYYY-MM-DD), otras el formato completo
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // Al menos un día en el futuro
      startDate.setHours(0, 0, 0, 0);
      
      // Formatear fecha en formato ISO 8601 (YYYY-MM-DDTHH:MM:SS.sssZ)
      // Mercado Pago puede requerir el formato completo o solo la fecha
      const formattedStartDate = startDate.toISOString();
      
      // Ajustar frecuencia para semanas y años
      let adjustedFrequency = data.intervalCount;
      if (data.intervalType === 'week') {
        adjustedFrequency = data.intervalCount * 7; // Convertir semanas a días
      } else if (data.intervalType === 'year') {
        adjustedFrequency = data.intervalCount * 12; // Convertir años a meses
      }

      // Validar que el monto sea un número válido y positivo
      if (!data.amount || data.amount <= 0 || isNaN(data.amount)) {
        throw new BadRequestException('El monto debe ser un número positivo válido');
      }

      // Validar que la frecuencia sea válida
      if (!adjustedFrequency || adjustedFrequency <= 0) {
        throw new BadRequestException('La frecuencia debe ser un número positivo válido');
      }

      // Construir el objeto de suscripción según la API de Mercado Pago
      const subscriptionData: any = {
        reason: data.planName,
        external_reference: data.externalReference,
        payer_email: data.payerEmail,
        auto_recurring: {
          frequency: adjustedFrequency,
          frequency_type: frequencyType,
          start_date: formattedStartDate,
          transaction_amount: Number(data.amount.toFixed(2)), // Asegurar formato decimal correcto
          currency_id: data.currency,
        },
        back_url: data.backUrl || `${this.configService.get<string>('APP_URL', 'http://localhost:3000')}/subscriptions/callback`,
      };

      // Nota: end_date no se incluye para suscripciones indefinidas
      // Si en el futuro se necesita una fecha de fin, se puede agregar aquí:
      // const endDate: Date | null = null;
      // if (endDate) {
      //   subscriptionData.auto_recurring.end_date = endDate.toISOString();
      // }

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

      // Log del payload para debugging (solo en desarrollo)
      if (process.env.NODE_ENV !== 'production') {
        console.log('Payload enviado a Mercado Pago:', JSON.stringify(subscriptionData, null, 2));
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
    } catch (error: any) {
      console.error('Error creando suscripción en Mercado Pago:', error);
      
      // Extraer más información del error
      let errorMessage = error.message || 'Error desconocido';
      let errorDetails = error;
      
      if (error.cause) {
        errorDetails = error.cause;
        errorMessage = error.cause?.message || errorMessage;
      }
      
      if (error.response) {
        errorDetails = error.response;
        errorMessage = error.response?.message || errorMessage;
      }
      
      // Log detallado del error
      console.error('Detalles del error:', JSON.stringify(errorDetails, null, 2));
      
      throw new BadRequestException(
        `Error al crear la suscripción en Mercado Pago: ${errorMessage}`,
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

