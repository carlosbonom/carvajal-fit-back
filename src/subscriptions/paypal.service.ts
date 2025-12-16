import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class PayPalService {
  private client: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private isProduction: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    
    this.clientId = this.configService.get<string>(
      this.isProduction ? 'PAYPAL_CLIENT_ID' : 'PAYPAL_CLIENT_ID_SANDBOX',
    ) || '';
    
    this.clientSecret = this.configService.get<string>(
      this.isProduction ? 'PAYPAL_CLIENT_SECRET' : 'PAYPAL_CLIENT_SECRET_SANDBOX',
    ) || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('PayPal credentials not configured. PayPal payments will not work.');
    }

    const baseURL = this.isProduction 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log(`🔧 Ambiente PayPal: ${this.isProduction ? 'PRODUCCIÓN' : 'SANDBOX'}`);
  }

  /**
   * Obtiene un token de acceso de PayPal
   */
  private async getAccessToken(): Promise<string> {
    // Si tenemos un token válido, usarlo
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        `${this.isProduction ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      // El token expira en 32400 segundos (9 horas), guardamos con margen de 8 horas
      this.tokenExpiry = new Date(Date.now() + (8 * 60 * 60 * 1000));

      if (!this.accessToken) {
        throw new BadRequestException('No se recibió token de acceso de PayPal');
      }

      return this.accessToken;
    } catch (error: any) {
      console.error('Error al obtener token de PayPal:', error.response?.data || error.message);
      throw new BadRequestException('Error al autenticarse con PayPal');
    }
  }

  /**
   * Crea una orden de pago en PayPal
   */
  async createOrder(data: {
    amount: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
    description: string;
    customId?: string;
  }): Promise<{ id: string; approveUrl: string }> {
    try {
      const accessToken = await this.getAccessToken();

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: data.currency,
              value: data.amount.toFixed(2),
            },
            description: data.description,
            custom_id: data.customId,
          },
        ],
        application_context: {
          brand_name: 'Club Carvajal Fit',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: data.returnUrl,
          cancel_url: data.cancelUrl,
        },
      };

      const response = await this.client.post('/v2/checkout/orders', orderData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const order = response.data;

      // Buscar el link de aprobación
      const approveLink = order.links?.find((link: any) => link.rel === 'approve');
      
      if (!approveLink || !order.id) {
        throw new BadRequestException('Error al crear orden de PayPal: no se recibió URL de aprobación');
      }

      return {
        id: order.id,
        approveUrl: approveLink.href,
      };
    } catch (error: any) {
      console.error('Error al crear orden PayPal:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Error al crear la orden de PayPal',
      );
    }
  }

  /**
   * Captura y obtiene el resultado de una orden de PayPal
   */
  async captureOrder(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await this.client.post(
        `/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      console.error('Error al capturar orden PayPal:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Error al capturar la orden de PayPal',
      );
    }
  }

  /**
   * Obtiene los detalles de una orden sin capturarla
   */
  async getOrderDetails(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await this.client.get(`/v2/checkout/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error al obtener detalles de orden PayPal:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Error al obtener detalles de la orden',
      );
    }
  }

  /**
   * Obtiene los detalles de una captura específica
   * Útil para verificar el estado actual de una captura que puede estar en PENDING
   */
  async getCaptureDetails(captureId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await this.client.get(`/v2/payments/captures/${captureId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error al obtener detalles de captura PayPal:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Error al obtener detalles de la captura',
      );
    }
  }
}

