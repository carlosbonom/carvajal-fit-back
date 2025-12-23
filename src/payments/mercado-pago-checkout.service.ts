import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class MercadoPagoCheckoutService {
    private defaultClient: AxiosInstance;
    private defaultAccessToken: string;
    private defaultIsSandbox: boolean;

    constructor(private configService: ConfigService) {
        this.defaultAccessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') || '';
        this.defaultIsSandbox = this.defaultAccessToken.startsWith('TEST-');

        if (!this.defaultAccessToken) {
            console.warn('MERCADOPAGO_ACCESS_TOKEN no está configurado por defecto.');
        }

        this.defaultClient = this.createClient(this.defaultAccessToken);
    }

    private createClient(accessToken: string): AxiosInstance {
        const isSandbox = accessToken.startsWith('TEST-');
        return axios.create({
            baseURL: 'https://api.mercadopago.com',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                ...(isSandbox && { 'X-scope': 'stage' }),
            },
        });
    }

    private getClient(accessToken?: string): { client: AxiosInstance; isSandbox: boolean } {
        if (accessToken) {
            return {
                client: this.createClient(accessToken),
                isSandbox: accessToken.startsWith('TEST-')
            };
        }

        if (!this.defaultAccessToken) {
            throw new Error('Default Mercado Pago credentials not configured');
        }

        return { client: this.defaultClient, isSandbox: this.defaultIsSandbox };
    }

    /**
     * Crea una preferencia de pago (Checkout Pro)
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
    }, accessToken?: string): Promise<{ id: string; initPoint: string; sandboxInitPoint?: string }> {
        try {
            const { client } = this.getClient(accessToken);

            // Validar que returnUrl esté definido y sea una URL válida
            if (!data.returnUrl || data.returnUrl.trim() === '') {
                throw new BadRequestException('returnUrl es requerido y no puede estar vacío para crear la preferencia de pago');
            }

            const backUrls = {
                success: data.returnUrl,
                failure: data.cancelUrl || data.returnUrl,
                pending: data.returnUrl,
            };

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
                // Quitar auto_return porque Mercado Pago tiene problemas con localhost
                notification_url: `${process.env.APP_URL || 'https://carvajalfit.fydeli.com'}/subscriptions/mercadopago/webhook`,
                statement_descriptor: 'Carvajal Fit',
                payment_methods: {
                    excluded_payment_methods: [],
                    excluded_payment_types: [],
                    installments: 1,
                },
            };

            if (data.payerEmail || data.payerName) {
                preference.payer = {};
                if (data.payerEmail) {
                    preference.payer.email = data.payerEmail;
                }
                if (data.payerName) {
                    preference.payer.name = data.payerName;
                }
            }

            console.log('📊 Creando preferencia de pago Mercado Pago');

            const response = await client.post('/checkout/preferences', preference);

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
    async getPayment(paymentId: string, accessToken?: string): Promise<any> {
        try {
            const { client } = this.getClient(accessToken);
            const response = await client.get(`/v1/payments/${paymentId}`);
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
    async getPreference(preferenceId: string, accessToken?: string): Promise<any> {
        try {
            const { client } = this.getClient(accessToken);
            const response = await client.get(`/checkout/preferences/${preferenceId}`);
            return response.data;
        } catch (error: any) {
            console.error('Error al obtener preferencia de Mercado Pago:', error.response?.data || error.message);
            throw new BadRequestException(
                error.response?.data?.message || 'Error al obtener la preferencia',
            );
        }
    }
}
