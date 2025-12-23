import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface PayPalCredentials {
    clientId: string;
    clientSecret: string;
    isProduction: boolean;
}

@Injectable()
export class PayPalService {
    private defaultClient: AxiosInstance;
    private isProduction: boolean;

    // Cache para tokens por credenciales (clientId -> token info)
    private tokenCache: Map<string, { accessToken: string; expiry: Date }> = new Map();

    constructor(private configService: ConfigService) {
        this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';

        // Configurar cliente base por defecto (sin auth header fijo porque el token cambia)
        const baseURL = this.isProduction
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        this.defaultClient = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
    }

    private getBaseUrl(isProduction: boolean): string {
        return isProduction
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    /**
     * Obtiene un token de acceso de PayPal
     */
    private async getAccessToken(credentials?: PayPalCredentials): Promise<string> {
        let clientId = credentials?.clientId;
        let clientSecret = credentials?.clientSecret;
        let isProduction = credentials?.isProduction ?? this.isProduction;

        // Si no se proveen credenciales, usar las del entorno
        if (!clientId || !clientSecret) {
            clientId = this.configService.get<string>(
                this.isProduction ? 'PAYPAL_CLIENT_ID' : 'PAYPAL_CLIENT_ID_SANDBOX',
            );
            clientSecret = this.configService.get<string>(
                this.isProduction ? 'PAYPAL_CLIENT_SECRET' : 'PAYPAL_CLIENT_SECRET_SANDBOX',
            );
        }

        if (!clientId || !clientSecret) {
            throw new Error('PayPal credentials missing');
        }

        // Verificar cache
        const cacheKey = clientId;
        const cached = this.tokenCache.get(cacheKey);
        if (cached && cached.expiry > new Date()) {
            return cached.accessToken;
        }

        try {
            const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const baseUrl = this.getBaseUrl(isProduction);

            const response = await axios.post(
                `${baseUrl}/v1/oauth2/token`,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
            );

            const accessToken = response.data.access_token;
            // Guardar en cache (9 horas de expiración, usamos 8 para margen)
            this.tokenCache.set(cacheKey, {
                accessToken,
                expiry: new Date(Date.now() + (8 * 60 * 60 * 1000))
            });

            return accessToken;

        } catch (error: any) {
            console.error('Error al obtener token de PayPal:', error.response?.data || error.message);
            throw new BadRequestException('Error al autenticarse con PayPal');
        }
    }

    private createClient(accessToken: string, isProduction: boolean): AxiosInstance {
        return axios.create({
            baseURL: this.getBaseUrl(isProduction),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
        });
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
    }, credentials?: PayPalCredentials): Promise<{ id: string; approveUrl: string }> {
        try {
            const accessToken = await this.getAccessToken(credentials);
            const isProduction = credentials?.isProduction ?? this.isProduction;
            const client = this.createClient(accessToken, isProduction);

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

            const response = await client.post('/v2/checkout/orders', orderData);

            const order = response.data;
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
    async captureOrder(orderId: string, credentials?: PayPalCredentials): Promise<any> {
        try {
            const accessToken = await this.getAccessToken(credentials);
            const isProduction = credentials?.isProduction ?? this.isProduction;
            const client = this.createClient(accessToken, isProduction);

            const response = await client.post(
                `/v2/checkout/orders/${orderId}/capture`,
                {}
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
    async getOrderDetails(orderId: string, credentials?: PayPalCredentials): Promise<any> {
        try {
            const accessToken = await this.getAccessToken(credentials);
            const isProduction = credentials?.isProduction ?? this.isProduction;
            const client = this.createClient(accessToken, isProduction);

            const response = await client.get(`/v2/checkout/orders/${orderId}`);

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
     */
    async getCaptureDetails(captureId: string, credentials?: PayPalCredentials): Promise<any> {
        try {
            const accessToken = await this.getAccessToken(credentials);
            const isProduction = credentials?.isProduction ?? this.isProduction;
            const client = this.createClient(accessToken, isProduction);

            const response = await client.get(`/v2/payments/captures/${captureId}`);

            return response.data;
        } catch (error: any) {
            console.error('Error al obtener detalles de captura PayPal:', error.response?.data || error.message);
            throw new BadRequestException(
                error.response?.data?.message || 'Error al obtener detalles de la captura',
            );
        }
    }
}
