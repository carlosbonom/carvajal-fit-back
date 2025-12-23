import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebpayPlus } from 'transbank-sdk';

export interface WebpayCredentials {
    commerceCode: string;
    apiKey: string;
}

@Injectable()
export class WebpayService {
    private defaultWebpayPlus: any;
    private isProduction: boolean;

    constructor(private configService: ConfigService) {
        // Configurar WebPay por defecto según el entorno
        this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        // this.isProduction = false; // Forzamos false si queremos probar integración siempre, pero mejor respetar env

        try {
            this.defaultWebpayPlus = this.createInstance(
                this.configService.get<string>(this.isProduction ? 'WEBPAY_COMMERCE_CODE' : 'WEBPAY_COMMERCE_CODE_TEST') || '',
                this.configService.get<string>(this.isProduction ? 'WEBPAY_API_KEY' : 'WEBPAY_API_KEY_TEST') || ''
            );
            console.log('✅ WebPay Service inicializado correctamente con credenciales por defecto');
        } catch (error) {
            console.warn('⚠️ WebPay Service: No se pudieron cargar las credenciales por defecto. Se requerirán credenciales explícitas para cada transacción.');
        }
    }

    private createInstance(commerceCode: string, apiKey: string): any {
        if (!commerceCode || !apiKey) {
            throw new Error('WebPay credentials missing');
        }

        const environmentUrl = this.isProduction
            ? 'https://webpay3g.transbank.cl'
            : 'https://webpay3gint.transbank.cl';

        const options: any = {
            commerceCode,
            apiKey,
            environment: environmentUrl,
        };

        return new WebpayPlus.Transaction(options);
    }

    private getInstance(credentials?: WebpayCredentials): any {
        if (credentials) {
            return this.createInstance(credentials.commerceCode, credentials.apiKey);
        }

        if (!this.defaultWebpayPlus) {
            throw new Error('Default WebPay credentials not configured');
        }

        return this.defaultWebpayPlus;
    }

    /**
     * Inicia una transacción de WebPay Plus
     */
    async createTransaction(
        data: {
            buyOrder: string;
            sessionId: string;
            amount: number;
            returnUrl: string;
        },
        credentials?: WebpayCredentials
    ): Promise<{ token: string; url: string }> {
        try {
            const transaction = this.getInstance(credentials);

            console.log('🔵 Creando transacción WebPay', {
                buyOrder: data.buyOrder,
                amount: data.amount,
                hasCustomCredentials: !!credentials
            });

            const response = await transaction.create(
                data.buyOrder,
                data.sessionId,
                data.amount,
                data.returnUrl,
            );

            console.log('✅ Respuesta de WebPay:', response);

            if (!response || !response.token || !response.url) {
                throw new BadRequestException('Error al crear la transacción de WebPay: respuesta inválida');
            }

            return {
                token: response.token,
                url: response.url,
            };
        } catch (error: any) {
            console.error('❌ Error al crear transacción WebPay:', error);
            throw new BadRequestException(
                error.message || 'Error al crear la transacción de WebPay',
            );
        }
    }

    /**
     * Confirma y obtiene el resultado de una transacción
     */
    async commitTransaction(token: string, credentials?: WebpayCredentials): Promise<any> {
        try {
            const transaction = this.getInstance(credentials);
            const response = await transaction.commit(token);
            return response;
        } catch (error: any) {
            console.error('Error al confirmar transacción WebPay:', error);
            throw new BadRequestException(
                error.message || 'Error al confirmar la transacción',
            );
        }
    }

    /**
     * Obtiene el estado de una transacción (sin confirmarla)
     */
    async getTransactionStatus(token: string, credentials?: WebpayCredentials): Promise<any> {
        try {
            const transaction = this.getInstance(credentials);
            const response = await transaction.status(token);
            return response;
        } catch (error: any) {
            console.error('Error al obtener estado de transacción WebPay:', error);
            throw new BadRequestException(
                error.message || 'Error al obtener el estado de la transacción',
            );
        }
    }
}
