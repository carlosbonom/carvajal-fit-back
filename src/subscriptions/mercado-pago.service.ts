import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

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
      // Para suscripciones, generalmente se usa la fecha actual + 1 día o másr
      const now = new Date();
      // Asegurar que la fecha de inicio sea en el futuro (ej. 1 hora después)
      // para evitar errores por latencia o diferencias de reloj con MP
      const startDate = new Date(now.getTime() + 60 * 60 * 1000);

      // Calcular fecha de fin (1 año desde la fecha de inicio)
      const endDate = new Date(startDate);
      endDate.setUTCFullYear(endDate.getUTCFullYear() + 5);

      // Formatear fechas en formato ISO 8601 completo: YYYY-MM-DDTHH:MM:SS.sssZ
      // Mercado Pago PreApproval requiere este formato exacto con milisegundos
      const formattedStartDate = startDate.toISOString();
      const formattedEndDate = endDate.toISOString();
      console.log(`Fecha de inicio calculada: ${formattedStartDate}`);
      console.log(`Fecha de fin calculada: ${formattedEndDate}`);
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

      // Sanitizar email (quitar el alias + si existe)
      let sanitizedEmail = data.payerEmail;
      if (data.payerEmail.includes('+') && data.payerEmail.includes('@')) {
        const [localPart, domainPart] = data.payerEmail.split('@');
        const [realLocalPart] = localPart.split('+');
        sanitizedEmail = `${realLocalPart}@${domainPart}`;
      }

      const subscriptionData: any = {
        reason: data.planName,
        external_reference: data.externalReference,
        payer_email: sanitizedEmail,
        auto_recurring: {
          frequency: adjustedFrequency,
          frequency_type: frequencyType,
          transaction_amount: transactionAmount,
          currency_id: data.currency,
        },
        back_url: this.getValidBackUrl(data.backUrl),
        status: 'pending',
      };

      // Log del payload para debugging
      const isSandbox = this.accessToken.startsWith('TEST-');
      console.log('=== PAYLOAD ENVIADO A MERCADO PAGO ===');
      console.log(`Ambiente: ${isSandbox ? 'SANDBOX' : 'PRODUCCIÓN'}`);
      console.log(JSON.stringify(subscriptionData, null, 2));
      console.log('=======================================');

      console.log('Enviando solicitud a Mercado Pago...');

      // Llamar directamente a la API REST de Mercado Pago usando axios
      const apiUrl = `${this.baseUrl}/preapproval`;
      console.log(`URL: ${apiUrl}`);

      // Preparar headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      };

      // Headers básicos de la solicitud

      // NOTA: Se ha eliminado temporalmente X-Idempotency-Key para evitar errores 500
      // cuando se reintenta con el mismo external_reference pero diferente payload.
      // headers['X-Idempotency-Key'] = data.externalReference;

      console.log('Headers:', JSON.stringify(headers, null, 2));

      try {
        const response = await axios.post(apiUrl, subscriptionData, {
          headers,
          validateStatus: () => true, // No lanzar error automáticamente para cualquier status
        });

        console.log('=== RESPUESTA DE MERCADO PAGO ===');
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Headers:', JSON.stringify(response.headers, null, 2));
        console.log('Body:', JSON.stringify(response.data, null, 2));
        console.log('=================================');

        if (response.status < 200 || response.status >= 300) {
          const errorData = response.data || { message: 'Sin detalles del error', status: response.status };

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

          console.error('Error de Mercado Pago:', JSON.stringify(errorData, null, 2));
          console.error('X-Request-ID:', response.headers['x-request-id'] || 'No disponible');
          console.error('Full Response Headers:', JSON.stringify(response.headers, null, 2));

          throw {
            message: errorMessage,
            status: response.status,
            statusText: response.statusText,
            data: errorData,
            requestId: response.headers['x-request-id'],
            response: {
              status: response.status,
              statusText: response.statusText,
              data: errorData,
            },
          };
        }

        const responseData = response.data;
        console.log('Respuesta recibida de Mercado Pago:', JSON.stringify(responseData, null, 2));

        return {
          id: responseData.id,
          status: responseData.status,
          initPoint: isSandbox ? (responseData.sandbox_init_point || responseData.init_point) : (responseData.init_point || responseData.sandbox_init_point),
          sandboxInitPoint: responseData.sandbox_init_point || null,
          externalReference: responseData.external_reference,
          payerEmail: responseData.payer_email,
          reason: responseData.reason,
          autoRecurring: responseData.auto_recurring,
        };
      } catch (axiosError: any) {
        // Si es un error de axios, extraer la información
        if (axios.isAxiosError(axiosError)) {
          const error = axiosError as AxiosError;
          if (error.response) {
            // El servidor respondió con un código de estado fuera del rango 2xx
            const errorData = error.response.data || { message: 'Error desconocido' };
            console.error('=== AXIOS ERROR RESPONSE ===');
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(errorData, null, 2));
            console.error('============================');
            throw {
              message: (errorData as any).message || `Error HTTP ${error.response.status}`,
              status: error.response.status,
              statusText: error.response.statusText,
              data: errorData,
              requestId: error.response.headers['x-request-id'],
              response: {
                status: error.response.status,
                statusText: error.response.statusText,
                data: errorData,
              },
            };
          } else if (error.request) {
            // La solicitud se hizo pero no se recibió respuesta
            throw {
              message: 'No se recibió respuesta del servidor de Mercado Pago',
              status: 0,
              request: error.request,
            };
          }
        }
        // Si no es un error de axios, re-lanzar el error original
        throw axiosError;
      }
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
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo suscripción de Mercado Pago:', error);

      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data || { message: 'Error desconocido' };
        throw new BadRequestException(
          `Error al obtener la suscripción de Mercado Pago: ${(errorData as any).message || 'Error desconocido'}`,
        );
      }

      throw new BadRequestException(
        `Error al obtener la suscripción de Mercado Pago: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const apiUrl = `${this.baseUrl}/preapproval/${subscriptionId}`;
      const response = await axios.put(
        apiUrl,
        {
          status: 'cancelled',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      console.error('Error cancelando suscripción en Mercado Pago:', error);

      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data || { message: 'Error desconocido' };
        throw new BadRequestException(
          `Error al cancelar la suscripción de Mercado Pago: ${(errorData as any).message || 'Error desconocido'}`,
        );
      }

      throw new BadRequestException(
        `Error al cancelar la suscripción de Mercado Pago: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  async getPayment(paymentId: string) {
    try {
      const apiUrl = `${this.baseUrl}/v1/payments/${paymentId}`;
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo pago de Mercado Pago:', error);

      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data || { message: 'Error desconocido' };
        throw new BadRequestException(
          `Error al obtener el pago de Mercado Pago: ${(errorData as any).message || 'Error desconocido'}`,
        );
      }

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

  private getValidBackUrl(backUrl?: string): string {
    const defaultUrl = `${this.configService.get<string>('APP_URL', 'https://carvajalfit.com')}/checkout/success`;

    if (!backUrl) {
      return defaultUrl;
    }

    // Mercado Pago no acepta localhost, así que si estamos en desarrollo
    // usamos la URL de producción o la configurada en APP_URL
    if (backUrl.includes('localhost') || backUrl.includes('127.0.0.1')) {
      console.log(`⚠️ URL de retorno ${backUrl} es local. Usando ${defaultUrl} para Mercado Pago Preapproval.`);
      return defaultUrl;
    }

    // Validar que sea una URL válida
    try {
      new URL(backUrl);
      return backUrl;
    } catch (e) {
      console.warn(`⚠️ URL de retorno inválida: ${backUrl}. Usando por defecto.`);
      return defaultUrl;
    }
  }

  async searchSubscriptions(filters: any = {}) {
    try {
      const apiUrl = `${this.baseUrl}/preapproval/search`;

      // Los parámetros de búsqueda comunes de Mercado Pago:
      // status, payer_email, reason, external_reference, sort, limit, offset
      const response = await axios.get(apiUrl, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error buscando suscripciones en Mercado Pago:', error);

      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data || { message: 'Error desconocido' };
        throw new BadRequestException(
          `Error al buscar suscripciones en Mercado Pago: ${(errorData as any).message || 'Error desconocido'}`,
        );
      }

      throw new BadRequestException(
        `Error al buscar suscripciones en Mercado Pago: ${error.message || 'Error desconocido'}`,
      );
    }
  }
}

