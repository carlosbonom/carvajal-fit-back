import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  private accessToken: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado en las variables de entorno');
    }

    this.accessToken = accessToken;

    // Detectar si es sandbox (los tokens de sandbox suelen empezar con "TEST-")
    const isSandbox = accessToken.startsWith('TEST-');
    // URL base de la API de Mercado Pago
    this.baseUrl = 'https://api.mercadopago.com';
    
    console.log(`🔧 Ambiente Mercado Pago: ${isSandbox ? 'SANDBOX (Pruebas)' : 'PRODUCCIÓN'}`);
    console.log(`🔗 URL Base: ${this.baseUrl}`);
  }

  async createSubscription(data: CreateSubscriptionData) {
    try {
      console.log('=== DATOS RECIBIDOS PARA CREAR SUSCRIPCIÓN ===');
      console.log('Datos:', JSON.stringify(data, null, 2));
      
      // Mapear intervalType a frequency_type de Mercado Pago
      const frequencyType = this.mapIntervalTypeToFrequencyType(data.intervalType);
      console.log(`IntervalType: ${data.intervalType} -> FrequencyType: ${frequencyType}`);
      
      // Calcular fecha de inicio
      // Mercado Pago requiere que la fecha esté en el futuro
      // Para suscripciones, generalmente se usa la fecha actual + 1 día o más
      // Usar la fecha actual + 1 día a las 00:00:00 UTC
      const now = new Date();
      const startDate = new Date(now);
      startDate.setUTCDate(startDate.getUTCDate() + 1); // Mañana
      startDate.setUTCHours(0, 0, 0, 0);
      
      // Formatear fecha en formato ISO 8601 completo: YYYY-MM-DDTHH:MM:SS.sssZ
      // Mercado Pago PreApproval requiere este formato exacto con milisegundos
      const formattedStartDate = startDate.toISOString();
      console.log(`Fecha de inicio calculada: ${formattedStartDate}`);
      console.log(`Fecha actual: ${now.toISOString()}`);
      console.log(`Diferencia en días: ${Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}`);
      
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
      
      // Asegurar que el monto sea un número decimal válido
      // Mercado Pago requiere que sea un número (puede ser entero o decimal)
      const transactionAmount = Number(data.amount);
      console.log(`Monto formateado: ${transactionAmount} (tipo: ${typeof transactionAmount})`);
      
      // Validar que el monto no sea 0
      if (transactionAmount === 0 || isNaN(transactionAmount)) {
        throw new BadRequestException('El monto debe ser un número válido mayor a cero');
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
          transaction_amount: transactionAmount,
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

      // Si hay card_token_id, es una suscripción con pago autorizado
      // De lo contrario, es una suscripción con pago pendiente
      if (data.paymentMethodId) {
        subscriptionData.card_token_id = data.paymentMethodId;
        subscriptionData.status = 'authorized';
        console.log('⚠️ Creando suscripción con pago AUTORIZADO (card_token_id proporcionado)');
      } else {
        // Para suscripciones con pago pendiente, el status debe ser "pending"
        subscriptionData.status = 'pending';
        console.log('⚠️ Creando suscripción con pago PENDIENTE (status: pending)');
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

      // Log del payload para debugging
      const isSandbox = this.accessToken.startsWith('TEST-');
      console.log('=== PAYLOAD ENVIADO A MERCADO PAGO ===');
      console.log(`Ambiente: ${isSandbox ? 'SANDBOX' : 'PRODUCCIÓN'}`);
      console.log(JSON.stringify(subscriptionData, null, 2));
      console.log('=======================================');

      console.log('Enviando solicitud a Mercado Pago...');
      
      // Llamar directamente a la API REST de Mercado Pago
      const apiUrl = `${this.baseUrl}/preapproval`;
      console.log(`URL: ${apiUrl}`);
      
      // Preparar headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      };
      
      // Agregar X-scope: stage para sandbox (según documentación de Mercado Pago)
      if (isSandbox) {
        headers['X-scope'] = 'stage';
      }
      
      // Agregar X-Idempotency-Key para evitar duplicados
      headers['X-Idempotency-Key'] = data.externalReference;
      
      console.log('Headers:', JSON.stringify(headers, null, 2));
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(subscriptionData),
      });

      const responseText = await response.text();
      console.log(`Status Code: ${response.status}`);
      console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
      console.log(`Response Body: ${responseText}`);

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
          errorData = { message: responseText || 'Sin detalles del error', status: response.status };
        }
        
        // Mensajes específicos según el código de estado
        let errorMessage = errorData.message || `Error HTTP ${response.status}`;
        
        if (response.status === 503) {
          errorMessage = 'Servicio de Mercado Pago temporalmente no disponible. Por favor, intenta nuevamente en unos momentos.';
          console.error('⚠️ Error 503: Servicio de Mercado Pago no disponible temporalmente');
          console.error('💡 Sugerencia: Espera unos minutos y vuelve a intentar');
        } else if (response.status === 500) {
          errorMessage = 'Error interno del servidor de Mercado Pago. Por favor, intenta nuevamente.';
          console.error('⚠️ Error 500: Error interno del servidor de Mercado Pago');
        } else if (response.status === 400) {
          errorMessage = errorData.message || 'Error en la solicitud. Verifica los datos enviados.';
          console.error('⚠️ Error 400: Error en la solicitud');
          console.error('Detalles:', errorData);
        }
        
        console.error('Error de Mercado Pago:', errorData);
        console.error('X-Request-ID:', response.headers.get('x-request-id') || 'No disponible');
        
        throw {
          message: errorMessage,
          status: response.status,
          statusText: response.statusText,
          data: errorData,
          requestId: response.headers.get('x-request-id'),
          response: {
            status: response.status,
            statusText: response.statusText,
            data: errorData,
          },
        };
      }

      const responseData = JSON.parse(responseText);
      console.log('Respuesta recibida de Mercado Pago:', JSON.stringify(responseData, null, 2));

      return {
        id: responseData.id,
        status: responseData.status,
        initPoint: responseData.init_point || responseData.sandbox_init_point || null,
        sandboxInitPoint: responseData.sandbox_init_point || null,
        externalReference: responseData.external_reference,
        payerEmail: responseData.payer_email,
        reason: responseData.reason,
        autoRecurring: responseData.auto_recurring,
      };
    } catch (error: any) {
      console.error('=== ERROR AL CREAR SUSCRIPCIÓN EN MERCADO PAGO ===');
      console.error('Error:', error);
      console.error('Tipo de error:', typeof error);
      console.error('Constructor:', error?.constructor?.name);
      
      // Obtener todas las propiedades del error
      const errorKeys = Object.keys(error);
      console.error('Propiedades del error:', errorKeys);
      
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
      
      // Intentar acceder a todas las propiedades posibles
      for (const key of errorKeys) {
        try {
          errorDetails[key] = error[key];
        } catch (e) {
          // Ignorar propiedades que no se pueden acceder
        }
      }
      
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
        // Intentar acceder a propiedades de la respuesta HTTP
        if (error.response.status) {
          errorDetails.httpStatus = error.response.status;
        }
        if (error.response.statusText) {
          errorDetails.httpStatusText = error.response.statusText;
        }
        if (error.response.headers) {
          errorDetails.httpHeaders = error.response.headers;
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
      
      // Intentar loggear el error de forma más directa
      console.error('Error.toString():', error.toString());
      console.error('Error.valueOf():', error.valueOf());
      
      console.error('==================================================');
      
      throw new BadRequestException(
        `Error al crear la suscripción en Mercado Pago: ${errorMessage}`,
      );
    }
  }

  async getSubscription(subscriptionId: string) {
    try {
      const apiUrl = `${this.baseUrl}/preapproval/${subscriptionId}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        throw {
          message: errorData.message || `Error HTTP ${response.status}`,
          status: response.status,
          data: errorData,
        };
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error obteniendo suscripción de Mercado Pago:', error);
      throw new BadRequestException(
        `Error al obtener la suscripción de Mercado Pago: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const apiUrl = `${this.baseUrl}/preapproval/${subscriptionId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          status: 'cancelled',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        throw {
          message: errorData.message || `Error HTTP ${response.status}`,
          status: response.status,
          data: errorData,
        };
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error cancelando suscripción en Mercado Pago:', error);
      throw new BadRequestException(
        `Error al cancelar la suscripción de Mercado Pago: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  async getPayment(paymentId: string) {
    try {
      const apiUrl = `${this.baseUrl}/v1/payments/${paymentId}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        throw {
          message: errorData.message || `Error HTTP ${response.status}`,
          status: response.status,
          data: errorData,
        };
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error obteniendo pago de Mercado Pago:', error);
      throw new BadRequestException(
        `Error al obtener el pago de Mercado Pago: ${error.message || 'Error desconocido'}`,
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

