import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../database/entities/orders.entity';
import { Product } from '../database/entities/products.entity';
import { User } from '../database/entities/users.entity';
import { WebpayService, WebpayCredentials } from '../payments/webpay.service';
import { MercadoPagoCheckoutService } from '../payments/mercado-pago-checkout.service';
import { PayPalService, PayPalCredentials } from '../payments/paypal.service';

@Injectable()
export class MarketService {
    constructor(
        @InjectRepository(Order)
        private ordersRepository: Repository<Order>,
        @InjectRepository(Product)
        private productsRepository: Repository<Product>,
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        private configService: ConfigService,
        private webpayService: WebpayService,
        private mercadoPagoService: MercadoPagoCheckoutService,
        private payPalService: PayPalService,
    ) { }

    private getCreatorCredentials(creatorSlug: string) {
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        const prefix = creatorSlug.toUpperCase(); // JOSE or GABRIEL

        // Webpay Fallback
        const webpayCommerceCode = this.configService.get<string>(`${prefix}_WEBPAY_COMMERCE_CODE`) ||
            this.configService.get<string>(isProduction ? 'WEBPAY_COMMERCE_CODE' : 'WEBPAY_COMMERCE_CODE_TEST');
        const webpayApiKey = this.configService.get<string>(`${prefix}_WEBPAY_API_KEY`) ||
            this.configService.get<string>(isProduction ? 'WEBPAY_API_KEY' : 'WEBPAY_API_KEY_TEST');

        // PayPal Fallback
        const paypalClientId = this.configService.get<string>(`${prefix}_PAYPAL_CLIENT_ID`) ||
            this.configService.get<string>(isProduction ? 'PAYPAL_CLIENT_ID' : 'PAYPAL_CLIENT_ID_SANDBOX');
        const paypalClientSecret = this.configService.get<string>(`${prefix}_PAYPAL_CLIENT_SECRET`) ||
            this.configService.get<string>(isProduction ? 'PAYPAL_CLIENT_SECRET' : 'PAYPAL_CLIENT_SECRET_SANDBOX');

        // MercadoPago Fallback
        const mpAccessToken = this.configService.get<string>(`${prefix}_MERCADOPAGO_ACCESS_TOKEN`) ||
            this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');

        return {
            webpay: {
                commerceCode: webpayCommerceCode || '',
                apiKey: webpayApiKey || '',
            } as WebpayCredentials,
            paypal: {
                clientId: paypalClientId || '',
                clientSecret: paypalClientSecret || '',
                isProduction
            } as PayPalCredentials,
            mercadopago: {
                accessToken: mpAccessToken || '',
            }
        };
    }

    async createWebpayTransaction(
        user: User,
        items: { productId: string; quantity: number }[],
        creatorSlug: string
    ) {
        const products = await Promise.all(items.map(async item => {
            const product = await this.productsRepository.findOne({ where: { id: item.productId } });
            if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
            return { product, quantity: item.quantity };
        }));

        // Calculate total
        const total = products.reduce((sum, item) => {
            const price = item.product.prices.find(p => p.currency === 'CLP')?.amount || 0;
            return sum + (price * item.quantity);
        }, 0);

        const order = this.ordersRepository.create({
            user,
            orderNumber: `ORD-${Date.now()}`,
            status: OrderStatus.PENDING,
            subtotal: total,
            total: total,
            currency: 'CLP',
            paymentMethod: 'webpay',
            paymentProvider: 'webpay',
            billingEmail: user.email,
            metadata: { creatorSlug, items }
        });

        await this.ordersRepository.save(order);

        const credentials = this.getCreatorCredentials(creatorSlug).webpay;

        if (!credentials.commerceCode) {
            throw new BadRequestException(`Configuración de pago no encontrada para ${creatorSlug}`);
        }

        const { token, url } = await this.webpayService.createTransaction({
            buyOrder: order.orderNumber,
            sessionId: user.id,
            amount: total,
            returnUrl: `${this.configService.get('APP_URL')}/market/${creatorSlug}/checkout/validate?token={token}`, // Assuming frontend handles this route or backend
        }, credentials);

        return { token, url, orderId: order.id };
    }



    async validateWebpayTransaction(token: string, creatorSlug: string) {
        const credentials = this.getCreatorCredentials(creatorSlug).webpay;

        // Confirm transaction with WebPay
        const response = await this.webpayService.commitTransaction(token, credentials);

        // Find associated order
        const order = await this.ordersRepository.findOne({
            where: { orderNumber: response.buy_order },
            relations: ['user']
        });

        if (!order) {
            throw new NotFoundException(`Orden no encontrada para buyOrder: ${response.buy_order}`);
        }

        // Validate response code (0 = Authorized)
        // WebPay Plus response codes: https://www.transbankdevelopers.cl/documentacion/webpay-plus#codigos-de-respuesta
        if (response.status === 'AUTHORIZED' && response.response_code === 0) {
            order.status = OrderStatus.COMPLETED;
            order.paidAt = new Date();
            order.transactionId = token; // Or session_id / authorization_code
            // TODO: Reduce stock if necessary
        } else {
            order.status = OrderStatus.FAILED;
        }

        await this.ordersRepository.save(order);

        return {
            status: order.status,
            orderId: order.id,
            details: response
        };
    }

    // For brevity I'll implement placeholders that structure is correct
    async createMercadoPagoCheckout(
        user: User,
        items: { productId: string; quantity: number }[],
        creatorSlug: string
    ) {
        const credentials = this.getCreatorCredentials(creatorSlug).mercadopago;
        if (!credentials.accessToken) throw new BadRequestException(`Configuración de pago no encontrada para ${creatorSlug}`);

        // Logic similar to subscription but for order items...
        // TODO: Implement full logic
        // Return initPoint
        return { initPoint: 'https://placeholder.com', preferenceId: '123' };
    }

    async createPayPalOrder(
        user: User,
        items: { productId: string; quantity: number }[],
        creatorSlug: string
    ) {
        // TODO
        return { approveUrl: 'https://placeholder.com', orderId: '123' };
    }
}
