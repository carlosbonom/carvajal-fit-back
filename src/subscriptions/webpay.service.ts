import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebpayPlus } from 'transbank-sdk';

@Injectable()
export class WebpayService {
  private webpayPlus: any;
  private isProduction: boolean;

  constructor(private configService: ConfigService) {
    // Configurar WebPay según el entorno
    // this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.isProduction = false;
    const envVarName = this.isProduction ? 'WEBPAY_COMMERCE_CODE' : 'WEBPAY_COMMERCE_CODE_TEST';
    const apiKeyVarName = this.isProduction ? 'WEBPAY_API_KEY' : 'WEBPAY_API_KEY_TEST';
    
    const commerceCode = process.env[this.isProduction ? 'WEBPAY_COMMERCE_CODE' : 'WEBPAY_COMMERCE_CODE_TEST'];
    const apiKey = process.env[this.isProduction ? 'WEBPAY_API_KEY' : 'WEBPAY_API_KEY_TEST'];

    console.log('🔍 Verificando variables de entorno WebPay:');
    console.log(`  - NODE_ENV: ${this.configService.get<string>('NODE_ENV')}`);
    console.log(`  - Es producción: ${this.isProduction}`);
    console.log(`  - Variable commerceCode: ${envVarName}`);
    console.log(`  - commerceCode encontrado: ${commerceCode ? 'SÍ' : 'NO'}`);
    console.log(`  - Variable apiKey: ${apiKeyVarName}`);
    console.log(`  - apiKey encontrado: ${apiKey ? 'SÍ' : 'NO'}`);
    
    if (!commerceCode || !apiKey) {
      console.error(`❌ Variables de WebPay no configuradas correctamente`);
      throw new Error(
        `WebPay credentials not configured. Please set ${envVarName} and ${apiKeyVarName} in your .env file`,
      );
    }
    
    console.log(`✅ Credenciales WebPay encontradas (${commerceCode.substring(0, 8)}...)`);

    try {
      // El SDK de Transbank necesita la URL base completa en options.environment
      // URLs base según el entorno:
      // Integración: https://webpay3gint.transbank.cl
      // Producción: https://webpay3g.transbank.cl
      
      const environmentUrl = this.isProduction 
        ? 'https://webpay3g.transbank.cl'
        : 'https://webpay3gint.transbank.cl';

      // Configurar opciones para la instancia
      // El SDK espera que environment sea la URL base completa
      const options: any = {
        commerceCode,
        apiKey,
        environment: environmentUrl,
      };

      console.log('📦 Creando Transaction con opciones:', {
        commerceCode,
        apiKey: apiKey.substring(0, 10) + '...',
        environment: environmentUrl,
      });

      // Crear instancia de Transaction con las opciones
      this.webpayPlus = new WebpayPlus.Transaction(options);

      console.log('✅ WebPay SDK configurado correctamente');
      console.log(`📋 Instancia creada con commerceCode: ${commerceCode}`);
      console.log(`🌐 URL base configurada: ${environmentUrl}`);
    } catch (error: any) {
      console.error('Error al configurar WebPay SDK:', error);
      console.error('Detalles del error:', {
        message: error.message,
        stack: error.stack,
      });
      throw new Error(`Error al configurar WebPay: ${error.message}`);
    }

    console.log(`🔧 Ambiente WebPay: ${this.isProduction ? 'PRODUCCIÓN' : 'INTEGRACIÓN'}`);
    console.log(`📝 Commerce Code: ${commerceCode?.substring(0, 8)}...`);
  }

  /**
   * Inicia una transacción de WebPay Plus
   */
  async createTransaction(data: {
    buyOrder: string;
    sessionId: string;
    amount: number;
    returnUrl: string;
  }): Promise<{ token: string; url: string }> {
    try {
      console.log('🔵 Creando transacción WebPay con datos:', {
        buyOrder: data.buyOrder,
        sessionId: data.sessionId,
        amount: data.amount,
        returnUrl: data.returnUrl,
        environment: this.isProduction ? 'PRODUCCION' : 'INTEGRACION',
      });

      const response = await this.webpayPlus.create(
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
      console.error('Stack:', error.stack);
      if (error.cause) {
        console.error('Causa:', error.cause);
      }
      throw new BadRequestException(
        error.message || 'Error al crear la transacción de WebPay',
      );
    }
  }

  /**
   * Confirma y obtiene el resultado de una transacción
   * Este método confirma la transacción y obtiene los detalles
   */
  async commitTransaction(token: string): Promise<any> {
    try {
      const response = await this.webpayPlus.commit(token);
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
  async getTransactionStatus(token: string): Promise<any> {
    try {
      const response = await this.webpayPlus.status(token);
      return response;
    } catch (error: any) {
      console.error('Error al obtener estado de transacción WebPay:', error);
      throw new BadRequestException(
        error.message || 'Error al obtener el estado de la transacción',
      );
    }
  }
}

