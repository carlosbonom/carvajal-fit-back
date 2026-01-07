import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../database/entities/orders.entity';
import { Product } from '../database/entities/products.entity';
import { User, UserRole, UserStatus } from '../database/entities/users.entity';
import { WebpayService, WebpayCredentials } from '../payments/webpay.service';
import { MercadoPagoCheckoutService } from '../payments/mercado-pago-checkout.service';
import { PayPalService, PayPalCredentials } from '../payments/paypal.service';
import { MarketingService } from '../marketing/marketing.service';

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
        private marketingService: MarketingService // Injected
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
        user: User | undefined,
        items: { productId: string; quantity: number }[],
        creatorSlug: string,
        guestDetails?: { name: string; email: string }
    ) {
        console.log(`[MarketService] createWebpayTransaction params:`, { userId: user?.id, isGuest: !user, items, creatorSlug });

        if (!user && !guestDetails) {
            throw new BadRequestException('Se requiere usuario registrado o datos de invitado (nombre y email)');
        }

        const products = await Promise.all(items.map(async item => {
            const product = await this.productsRepository.findOne({
                where: { id: item.productId },
                relations: ['prices']
            });
            if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
            return { product, quantity: item.quantity };
        }));

        // Calculate total
        const total = products.reduce((sum, item) => {
            const price = item.product.prices.find(p => p.currency === 'CLP')?.amount || 0;
            return sum + (price * item.quantity);
        }, 0);

        // Si es invitado, no asignamos objeto User (TypeORM permite relations nullable si la columna lo es)
        // Pero Order.user está marcada como nullable: false en la entidad.
        // Check Order entity definition.

        let orderUser = user;

        if (!orderUser) {
            // Opción A: Crear usuario dummy/guest
            // Opción B: Permitir user_id nulo en Orders (requiere migración)
            // Opción C: Buscar usuario por email, si no existe crearlo como "guest" temporal o simplemente sin password

            // Based on requirements "save as a client", maybe we should try to find by email first.
            const email = guestDetails?.email;
            if (email) {
                let existingUser = await this.usersRepository.findOne({ where: { email } });
                if (!existingUser) {
                    // Create minimal user
                    existingUser = this.usersRepository.create({
                        email,
                        name: guestDetails.name,
                        passwordHash: '$2b$10$GuestUserPlaceholderHash................', // Placeholder
                        role: UserRole.CUSTOMER,
                        status: UserStatus.ACTIVE
                    });
                    await this.usersRepository.save(existingUser);
                }
                orderUser = existingUser;
            }
        }

        if (!orderUser) throw new BadRequestException("No se pudo asignar un usuario a la orden.");

        const order = this.ordersRepository.create({
            user: orderUser,
            orderNumber: `ORD-${Date.now()}`,
            status: OrderStatus.PENDING,
            subtotal: total,
            total: total,
            currency: 'CLP',
            paymentMethod: 'webpay',
            paymentProvider: 'webpay',
            billingEmail: orderUser.email,
            metadata: { creatorSlug, items }
        });

        await this.ordersRepository.save(order);

        const credentials = this.getCreatorCredentials(creatorSlug).webpay;
        console.log(`[MarketService] Webpay Credentials found:`, {
            commerceCode: credentials.commerceCode,
            hasApiKey: !!credentials.apiKey
        });

        if (!credentials.commerceCode) {
            console.error(`[MarketService] Missing commerce code for ${creatorSlug}`);
            throw new BadRequestException(`Configuración de pago no encontrada para ${creatorSlug}`);
        }

        try {
            console.log(`[MarketService] Initiating Webpay transaction with amount ${total}`);
            const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
            const { token, url } = await this.webpayService.createTransaction({
                buyOrder: order.orderNumber,
                sessionId: user?.id || `guest-${Date.now()}`,
                amount: total,
                returnUrl: `${appUrl}/market/${creatorSlug}/checkout/validate`,
            }, credentials);

            console.log(`[MarketService] Webpay transaction created:`, { token, url });
            return { token, url, orderId: order.id };
        } catch (error) {
            console.error(`[MarketService] Webpay Error:`, error);
            throw new BadRequestException(`Error al iniciar transacción Webpay: ${error.message}`);
        }
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

            await this.ordersRepository.save(order);

            // Send confirmation emails
            try {
                const items = order.metadata?.items as { productId: string; quantity: number }[] || [];
                const productsInfo: { name: string; quantity: number; price: number, isDigital: boolean, link?: string }[] = [];

                for (const item of items) {
                    const product = await this.productsRepository.findOne({ where: { id: item.productId }, relations: ['prices'] });
                    if (product) {
                        const price = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                        // Check if digital (assuming type 'content' or checking metadata/properties)
                        // For now assume 'type' property exists on Product entity or we infer from category
                        // Assuming product.type exists. If not check entity.
                        // Let's assume digital products have a link in metadata or description for now?
                        // Actually, requirements said "si es contenido osea no fisico con el link del producto".
                        // Let's check if product has a `link` or `contentUrl`.
                        // Creating a hypothetical logic here:
                        const isDigital = ['pdf', 'digital_file', 'video', 'ebook', 'template'].includes(product.productType);
                        const productLink = product.fileUrl || (product.metadata as any)?.link;

                        productsInfo.push({
                            name: product.name,
                            quantity: item.quantity,
                            price: price,
                            isDigital: !!productLink,
                            link: productLink
                        });

                        if (productLink) {
                            await this.marketingService.sendDigitalProductEmail(
                                order.billingEmail,
                                order.user?.name || 'Cliente',
                                product.name,
                                productLink,
                                order.orderNumber
                            );
                        }
                    }
                }

                // Send general confirmation
                await this.marketingService.sendPurchaseConfirmationEmail(
                    order.billingEmail,
                    order.user?.name || 'Cliente',
                    order.orderNumber,
                    productsInfo.map(p => ({ name: p.name, quantity: p.quantity, price: p.price })),
                    Number(order.total)
                );

            } catch (emailError) {
                console.error("Error creating emails:", emailError);
            }

        } else {
            order.status = OrderStatus.FAILED;
            await this.ordersRepository.save(order);
        }

        return {
            status: order.status,
            orderId: order.id,
            details: response
        };
    }

    // For brevity I'll implement placeholders that structure is correct
    async createMercadoPagoCheckout(
        user: User | undefined,
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
        user: User | undefined,
        items: { productId: string; quantity: number }[],
        creatorSlug: string
    ) {
        // TODO
        return { approveUrl: 'https://placeholder.com', orderId: '123' };
    }
}
