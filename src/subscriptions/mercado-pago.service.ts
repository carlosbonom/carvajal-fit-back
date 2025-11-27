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
      console.log('=== DATOS RECIBIDOS PARA CREAR SUSCRIPCIÓN ===');
      console.log('Datos:', JSON.stringify(data, null, 2));
      
      // Mapear intervalType a frequency_type de Mercado Pago
      const frequencyType = this.mapIntervalTypeToFrequencyType(data.intervalType);
      console.log(`IntervalType: ${data.intervalType} -> FrequencyType: ${frequencyType}`);
      
      // Calcular fecha de inicio (mañana a las 00:00:00 UTC para asegurar que sea válida)
      // Mercado Pago PreApproval API requiere formato ISO 8601 completo: YYYY-MM-DDTHH:MM:SSZ
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() + 1); // Al menos un día en el futuro
      startDate.setUTCHours(0, 0, 0, 0);
      
      // Formatear fecha en formato ISO 8601 completo con Z (UTC): YYYY-MM-DDTHH:MM:SSZ
      // Este es el formato requerido por Mercado Pago para start_date
      const formattedStartDate = startDate.toISOString();
      console.log(`Fecha de inicio calculada: ${formattedStartDate}`);
      
      // Ajustar frecuencia para semanas y años
      let adjustedFrequency = data.intervalCount;
      if (data.intervalType === 'week') {
        adjustedFrequency = data.intervalCount * 7; // Convertir semanas a días
      } else if (data.intervalType === 'year') {
        adjustedFrequency = data.intervalCount * 12; // Convertir años a meses
      }
      console.log(`Frecuencia ajustada: ${adjustedFrequency} (intervalCount: ${data.intervalCount})`);

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

      // Log del payload para debugging
      console.log('=== PAYLOAD ENVIADO A MERCADO PAGO ===');
      console.log(JSON.stringify(subscriptionData, null, 2));
      console.log('=======================================');

      console.log('Enviando solicitud a Mercado Pago...');
      const response = await this.preApproval.create({ body: subscriptionData });
      console.log('Respuesta recibida de Mercado Pago:', JSON.stringify(response, null, 2));

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
      console.error('=== ERROR AL CREAR SUSCRIPCIÓN EN MERCADO PAGO ===');
      console.error('Error:', error);
      console.error('Tipo de error:', typeof error);
      console.error('Constructor:', error?.constructor?.name);
      
      // Extraer más información del error del SDK de Mercado Pago
      let errorMessage = error.message || 'Error desconocido';
      let errorDetails: any = {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        cause: error.cause,
        response: error.response,
        stack: error.stack,
      };
      
      // El SDK de Mercado Pago puede tener la información en diferentes lugares
      if (error.cause) {
        errorDetails.cause = error.cause;
        if (error.cause.message) {
          errorMessage = error.cause.message;
        }
      }
      
      if (error.response) {
        errorDetails.response = error.response;
        if (error.response.message) {
          errorMessage = error.response.message;
        }
        if (error.response.data) {
          errorDetails.responseData = error.response.data;
        }
      }
      
      // Intentar extraer información de la respuesta HTTP si está disponible
      if (error.response?.data) {
        const responseData = error.response.data;
        if (typeof responseData === 'string') {
          try {
            errorDetails.parsedResponse = JSON.parse(responseData);
          } catch (e) {
            errorDetails.rawResponse = responseData;
          }
        } else {
          errorDetails.parsedResponse = responseData;
        }
      }
      
      // Intentar acceder a propiedades adicionales del error
      if (error.apiResponse) {
        errorDetails.apiResponse = error.apiResponse;
      }
      
      if (error.statusCode) {
        errorDetails.statusCode = error.statusCode;
      }
      
      // Log detallado del error
      console.error('Detalles completos del error:', JSON.stringify(errorDetails, null, 2));
      console.error('Error completo (objeto):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error('==================================================');
      
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

