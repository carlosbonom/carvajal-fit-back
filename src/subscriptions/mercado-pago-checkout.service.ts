import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class MercadoPagoCheckoutService {
  private client: AxiosInstance;
  private accessToken: string;
  private isSandbox: boolean;

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') || '';

    if (!this.accessToken) {
      console.warn('MERCADOPAGO_ACCESS_TOKEN no está configurado. Mercado Pago Checkout no funcionará.');
    }

    this.isSandbox = this.accessToken.startsWith('TEST-');

    this.client = axios.create({
      baseURL: 'https://api.mercadopago.com',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...(this.isSandbox && { 'X-scope': 'stage' }),
      },
    });

    console.log(`🔧 Ambiente Mercado Pago Checkout: ${this.isSandbox ? 'SANDBOX' : 'PRODUCCIÓN'}`);
  }

  /**
   * Crea una preferencia de pago (Checkout Pro)
   * Esta es la nueva forma recomendada para pagos únicos o suscripciones de pago único
   */
  async createPaymentPreference(data: {
    amount: number;
    currency: string;
    description: string;
    externalReference: string;
    returnUrl: string;
    cancelUrl: string;
    payerEmail?: string;
    payerName?: string;
  }): Promise<{ id: string; initPoint: string; sandboxInitPoint?: string }> {
    try {
      // Validar que returnUrl esté definido y sea una URL válida
      if (!data.returnUrl || data.returnUrl.trim() === '') {
        throw new BadRequestException('returnUrl es requerido y no puede estar vacío para crear la preferencia de pago');
      }

      // Validar que returnUrl sea una URL válida
      try {
        new URL(data.returnUrl);
      } catch (error) {
        throw new BadRequestException(`returnUrl debe ser una URL válida: ${data.returnUrl}`);
      }

      console.log('🔍 URLs de redirección:', {
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
      });

      const backUrls = {
        success: data.returnUrl,
        failure: data.cancelUrl || data.returnUrl,
        pending: data.returnUrl,
      };

      console.log('🔍 back_urls configurado:', JSON.stringify(backUrls, null, 2));

      const preference: any = {
        items: [
          {
            title: data.description,
            quantity: 1,
            unit_price: data.amount,
            currency_id: data.currency,
          },
        ],
        external_reference: data.externalReference,
        back_urls: backUrls,
        // Quitar auto_return porque Mercado Pago tiene problemas con localhost cuando se usa auto_return
        // El usuario será redirigido automáticamente usando back_urls
        notification_url: `${process.env.APP_URL || 'https://carvajalfit.com'}/subscriptions/mercadopago/webhook`,
        statement_descriptor: 'Carvajal Fit',
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 1,
        },
      };

      // Agregar información del pagador solo si está disponible
      if (data.payerEmail || data.payerName) {
        preference.payer = {};
        if (data.payerEmail) {
          preference.payer.email = data.payerEmail;
        }
        if (data.payerName) {
          preference.payer.name = data.payerName;
        }
      }

      console.log('📊 Creando preferencia de pago Mercado Pago:', JSON.stringify(preference, null, 2));

      const response = await this.client.post('/checkout/preferences', preference);

      const preferenceData = response.data;

      if (!preferenceData.id || !preferenceData.init_point) {
        throw new BadRequestException('Error al crear preferencia de pago: respuesta inválida');
      }

      return {
        id: preferenceData.id,
        initPoint: preferenceData.init_point,
        sandboxInitPoint: preferenceData.sandbox_init_point,
      };
    } catch (error: any) {
      console.error('Error al crear preferencia de pago Mercado Pago:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Error al crear la preferencia de pago',
      );
    }
  }

  /**
   * Obtiene información de un pago por su ID
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/payments/${paymentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error al obtener pago de Mercado Pago:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Error al obtener el pago',
      );
    }
  }

  /**
   * Obtiene información de una preferencia por su ID
   */
  async getPreference(preferenceId: string): Promise<any> {
    try {
      const response = await this.client.get(`/checkout/preferences/${preferenceId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error al obtener preferencia de Mercado Pago:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Error al obtener la preferencia',
      );
    }
  }
}

