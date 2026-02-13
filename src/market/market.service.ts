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
import { LiorenService } from '../lioren/lioren.service';

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
        private marketingService: MarketingService, // Injected
        private liorenService: LiorenService
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

    private async completeOrderAndSendEmails(order: Order, transactionId: string) {
        if (order.status === OrderStatus.COMPLETED) {
            console.log(`[MarketService] Order ${order.orderNumber} already completed. Skipping email sending.`);
            return;
        }

        console.log(`[MarketService] Completing order ${order.orderNumber} with transaction ${transactionId}`);

        order.status = OrderStatus.COMPLETED;
        order.paidAt = new Date();
        order.transactionId = transactionId;
        await this.ordersRepository.save(order);

        // Send confirmation emails
        try {
            const items = order.metadata?.items as { productId: string; quantity: number }[] || [];
            const productsInfo: { name: string; quantity: number; price: number, isDigital: boolean, link?: string }[] = [];

            for (const item of items) {
                const product = await this.productsRepository.findOne({ where: { id: item.productId }, relations: ['prices'] });
                if (product) {
                    const price = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                    const isDigital = ['pdf', 'digital_file', 'video', 'ebook', 'template'].includes(product.productType);

                    // Collect all links: from fileUrls array and fallback to single fileUrl
                    const productLinks: string[] = [];
                    if (product.fileUrls && Array.isArray(product.fileUrls)) {
                        productLinks.push(...product.fileUrls);
                    }
                    if (product.fileUrl && !productLinks.includes(product.fileUrl)) {
                        productLinks.push(product.fileUrl);
                    }
                    if ((product.metadata as any)?.link && !productLinks.includes((product.metadata as any).link)) {
                        productLinks.push((product.metadata as any).link);
                    }

                    productsInfo.push({
                        name: product.name,
                        quantity: item.quantity,
                        price: Number(price),
                        isDigital: isDigital,
                        links: productLinks
                    } as any);
                }
            }

            // Generar Boleta Lioren
            let boletaAttachments: any[] = [];
            try {
                const userRut = order.metadata?.userRut || this.configService.get<string>('LIOREN_DEFAULT_RUT') || '111111111';
                console.log(`[MarketService] Generating Lioren boleta for order ${order.orderNumber}. RUT: ${userRut}`);

                const boletaResult = await this.liorenService.generarBoletaCompra(
                    {
                        rut: userRut,
                        nombre: order.user?.name || 'Cliente',
                        email: order.billingEmail,
                        comuna: order.metadata?.comuna || 1,
                        ciudad: order.metadata?.ciudad || 1,
                    },
                    productsInfo.map(p => ({
                        nombre: p.name,
                        cantidad: p.quantity,
                        precio: p.price,
                        exento: (p as any).isDigital
                    })),
                    {
                        fechaPago: order.paidAt || new Date(),
                        referencia: order.orderNumber,
                    }
                );

                if (boletaResult && boletaResult.pdf) {
                    console.log(`[MarketService] Lioren boleta generated successfully. PDF size: ${boletaResult.pdf.length} bytes`);
                    boletaAttachments.push({
                        filename: `boleta_${order.orderNumber}.pdf`,
                        content: boletaResult.pdf,
                    });
                } else {
                    console.warn(`[MarketService] Lioren boleta generated but PDF is missing.`, boletaResult);
                }
            } catch (liorenError) {
                console.error(`[MarketService] Error generating Lioren boleta for order ${order.orderNumber}:`, liorenError);
            }

            // Enviar correos de productos digitales
            for (const p of productsInfo as any[]) {
                if (p.links && p.links.length > 0) {
                    await this.marketingService.sendDigitalProductEmail(
                        order.billingEmail,
                        order.user?.name || 'Cliente',
                        p.name,
                        p.links,
                        order.orderNumber,
                        boletaAttachments
                    );
                } else if ((p as any).link) { // Fallback for old structure if needed although we added to links above
                    await this.marketingService.sendDigitalProductEmail(
                        order.billingEmail,
                        order.user?.name || 'Cliente',
                        p.name,
                        [(p as any).link],
                        order.orderNumber,
                        boletaAttachments
                    );
                }
            }

            // Enviar confirmación de compra general
            await this.marketingService.sendPurchaseConfirmationEmail(
                order.billingEmail,
                order.user?.name || 'Cliente',
                order.orderNumber,
                productsInfo.map(p => ({ name: p.name, quantity: p.quantity, price: p.price })),
                Number(order.total),
                boletaAttachments
            );

        } catch (error) {
            console.error(`[MarketService] Error processing emails for order ${order.orderNumber}:`, error);
        }
    }

    async handleMercadoPagoPayment(paymentId: string) {
        console.log(`[MarketService] Handling MP payment: ${paymentId}`);

        // We need to find the order first to know which creator's token to use
        // But we don't have the external_reference yet.
        // Try with default token first to find the payment details
        const defaultAccessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
        let paymentDetails;

        try {
            paymentDetails = await this.mercadoPagoService.getPayment(paymentId, defaultAccessToken);
        } catch (error) {
            console.warn(`[MarketService] Could not fetch payment ${paymentId} with default token. Searching in DB by transactionId...`);
        }

        let order;
        if (paymentDetails?.external_reference) {
            order = await this.ordersRepository.findOne({
                where: { id: paymentDetails.external_reference },
                relations: ['user']
            });
        }

        // Fallback: search by transactionId if external_reference fetch failed or order not found
        if (!order) {
            order = await this.ordersRepository.findOne({
                where: { transactionId: paymentId },
                relations: ['user']
            });
        }

        if (!order) {
            console.error(`[MarketService] Order not found for MP payment ${paymentId}`);
            return;
        }

        // If we found the order, we can get the correct credentials and re-fetch if needed
        const creatorSlug = order.metadata?.creatorSlug;
        if (creatorSlug) {
            const credentials = this.getCreatorCredentials(creatorSlug).mercadopago;
            if (credentials.accessToken && credentials.accessToken !== defaultAccessToken) {
                // Re-fetch with correct token to be sure we have the latest status
                paymentDetails = await this.mercadoPagoService.getPayment(paymentId, credentials.accessToken);
            }
        }

        if (!paymentDetails) {
            console.error(`[MarketService] Could not retrieve payment details for ${paymentId}`);
            return;
        }

        // Re-use logic from validateMercadoPagoTransaction
        if (paymentDetails.status === 'approved') {
            await this.completeOrderAndSendEmails(order, paymentId);
        } else if (['rejected', 'cancelled'].includes(paymentDetails.status)) {
            order.status = OrderStatus.FAILED;
            await this.ordersRepository.save(order);
        }
    }

    private async getOrCreateUser(user: User | undefined, guestDetails?: { name: string; email: string }) {
        if (user) return user;

        if (!guestDetails?.email) {
            throw new BadRequestException('Se requiere usuario registrado o datos de invitado (nombre y email)');
        }

        const email = guestDetails.email;
        let existingUser = await this.usersRepository.findOne({ where: { email } });

        if (!existingUser) {
            existingUser = this.usersRepository.create({
                email,
                name: guestDetails.name || 'Invitado',
                passwordHash: '$2b$10$GuestUserPlaceholderHash................', // Placeholder
                role: UserRole.CUSTOMER,
                status: UserStatus.ACTIVE
            });
            await this.usersRepository.save(existingUser);
        }

        return existingUser;
    }

    async createWebpayTransaction(
        user: User | undefined,
        items: { productId: string; quantity: number }[],
        creatorSlug: string,
        guestDetails?: { name: string; email: string },
        origin?: string
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

        // Forzar precio en desarrollo
        let finalTotal = total;
        if (this.configService.get<string>('NODE_ENV') !== 'production') {
            finalTotal = 950;
        }

        const orderUser = await this.getOrCreateUser(user, guestDetails);

        const order = this.ordersRepository.create({
            user: orderUser,
            orderNumber: `ORD-${Date.now()}`,
            status: OrderStatus.PENDING,
            subtotal: finalTotal,
            total: finalTotal,
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
            console.log(`[MarketService] Initiating Webpay transaction with amount ${finalTotal}`);
            let appUrl = origin || this.configService.get('APP_URL') || 'http://localhost:3000';
            // Forzar redirección a producción si estamos en localhost (requerimiento del usuario)
            if (appUrl.includes('localhost')) {
                appUrl = 'https://carvajalfit.com';
            }
            const returnUrl = `${appUrl}/market/${creatorSlug}/checkout/validate`;
            console.log(`[MarketService] Webpay returnUrl: ${returnUrl}`);
            const { token, url } = await this.webpayService.createTransaction({
                buyOrder: order.orderNumber,
                sessionId: user?.id || `guest-${Date.now()}`,
                amount: finalTotal,
                returnUrl,
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
        if (response.status === 'AUTHORIZED' && response.response_code === 0) {
            await this.completeOrderAndSendEmails(order, token);
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

    async createMercadoPagoCheckout(
        user: User | undefined,
        items: { productId: string; quantity: number }[],
        creatorSlug: string,
        guestDetails?: { name: string; email: string },
        origin?: string
    ) {
        const credentials = this.getCreatorCredentials(creatorSlug).mercadopago;
        if (!credentials.accessToken) throw new BadRequestException(`Configuración de pago no encontrada para ${creatorSlug}`);

        const orderUser = await this.getOrCreateUser(user, guestDetails);

        let totalCLP = 0;
        const productsNames: string[] = [];

        for (const item of items) {
            const product = await this.productsRepository.findOne({
                where: { id: item.productId },
                relations: ['prices']
            });
            if (product) {
                const priceCLP = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                totalCLP += Number(priceCLP) * item.quantity;
                productsNames.push(`${item.quantity}x ${product.name}`);
            }
        }

        // Forzar precio en desarrollo
        let finalTotalCLP = totalCLP;
        if (this.configService.get<string>('NODE_ENV') !== 'production') {
            finalTotalCLP = 950;
        }

        const order = this.ordersRepository.create({
            user: orderUser,
            orderNumber: `ORD-MP-${Date.now()}`,
            status: OrderStatus.PENDING,
            subtotal: finalTotalCLP,
            total: finalTotalCLP,
            currency: 'CLP',
            paymentMethod: 'mercadopago',
            paymentProvider: 'mercadopago',
            billingEmail: orderUser.email,
            metadata: {
                creatorSlug,
                items,
                isMercadoPago: true
            }
        });

        await this.ordersRepository.save(order);

        let appUrl = origin || this.configService.get('APP_URL') || 'http://localhost:3000';
        // Forzar redirección a producción si estamos en localhost (para habilitar auto_return en MP)
        if (appUrl.includes('localhost')) {
            appUrl = 'https://carvajalfit.com';
        }
        const returnUrl = `${appUrl}/market/${creatorSlug}/checkout/validate?paymentProvider=mercadopago`;
        console.log(`[MarketService] Mercado Pago returnUrl: ${returnUrl}`);
        const preference = await this.mercadoPagoService.createPaymentPreference({
            amount: finalTotalCLP,
            currency: 'CLP',
            description: `Compra en ${creatorSlug}: ${productsNames.join(', ')}`,
            externalReference: order.id,
            returnUrl,
            cancelUrl: `${appUrl}/market/${creatorSlug}/checkout?canceled=true`,
            payerEmail: orderUser.email,
            payerName: orderUser.name || undefined,
        }, credentials.accessToken);

        order.transactionId = preference.id;
        await this.ordersRepository.save(order);

        return { initPoint: preference.initPoint, preferenceId: preference.id, orderId: order.id };
    }

    async validateMercadoPagoTransaction(paymentId: string, creatorSlug: string) {
        const credentials = this.getCreatorCredentials(creatorSlug).mercadopago;

        // Obtener detalles del pago
        const paymentDetails = await this.mercadoPagoService.getPayment(paymentId, credentials.accessToken);

        // Buscar la orden por external_reference o transactionId
        const orderId = paymentDetails.external_reference;
        const order = await this.ordersRepository.findOne({
            where: { id: orderId },
            relations: ['user']
        });

        if (!order) {
            throw new NotFoundException(`Orden no encontrada para Mercado Pago external_reference: ${orderId}`);
        }

        if (paymentDetails.status === 'approved') {
            await this.completeOrderAndSendEmails(order, paymentId);
        } else if (paymentDetails.status === 'rejected' || paymentDetails.status === 'cancelled') {
            order.status = OrderStatus.FAILED;
            await this.ordersRepository.save(order);
        }

        return {
            status: order.status,
            orderId: order.id,
            details: paymentDetails
        };
    }

    async createPayPalOrder(
        user: User | undefined,
        items: { productId: string; quantity: number }[],
        creatorSlug: string,
        guestDetails?: { name: string; email: string },
        origin?: string
    ) {
        const credentials = this.getCreatorCredentials(creatorSlug).paypal;

        const orderUser = await this.getOrCreateUser(user, guestDetails);

        let totalCLP = 0;
        const productsInfo: string[] = [];

        for (const item of items) {
            const product = await this.productsRepository.findOne({
                where: { id: item.productId },
                relations: ['prices']
            });
            if (product) {
                const priceCLP = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                totalCLP += Number(priceCLP) * item.quantity;
                productsInfo.push(`${item.quantity}x ${product.name}`);
            }
        }

        // Tasa de conversión fija para PayPal (CLP -> USD)
        const exchangeRate = 950;
        let totalUSD = parseFloat((totalCLP / exchangeRate).toFixed(2));

        // Forzar precio en desarrollo
        let finalTotalCLP = totalCLP;
        if (this.configService.get<string>('NODE_ENV') !== 'production') {
            finalTotalCLP = 950;
            totalUSD = 1;
        }

        const order = this.ordersRepository.create({
            user: orderUser,
            orderNumber: `ORD-PP-${Date.now()}`,
            status: OrderStatus.PENDING,
            subtotal: finalTotalCLP,
            total: finalTotalCLP,
            currency: 'CLP',
            paymentMethod: 'paypal',
            paymentProvider: 'paypal',
            billingEmail: orderUser.email,
            metadata: {
                creatorSlug,
                items,
                totalUSD,
                exchangeRate,
                isPayPal: true
            }
        });

        await this.ordersRepository.save(order);

        let appUrl = origin || this.configService.get('APP_URL') || 'http://localhost:3000';
        // Forzar redirección a producción si estamos en localhost
        if (appUrl.includes('localhost')) {
            appUrl = 'https://carvajalfit.com';
        }
        const returnUrl = `${appUrl}/market/${creatorSlug}/checkout/validate?paymentProvider=paypal`;
        console.log(`[MarketService] PayPal returnUrl: ${returnUrl}`);
        const paypalOrder = await this.payPalService.createOrder({
            amount: totalUSD,
            currency: 'USD',
            returnUrl,
            cancelUrl: `${appUrl}/market/${creatorSlug}/checkout?canceled=true`,
            description: `Compra en ${creatorSlug}: ${productsInfo.join(', ')}`,
            customId: order.id,
        }, credentials);

        order.transactionId = paypalOrder.id;
        await this.ordersRepository.save(order);

        return { approveUrl: paypalOrder.approveUrl, orderId: paypalOrder.id };
    }

    async validatePayPalTransaction(orderId: string, creatorSlug: string) {
        const credentials = this.getCreatorCredentials(creatorSlug).paypal;

        // Capturar la orden en PayPal
        const captureResult = await this.payPalService.captureOrder(orderId, credentials);

        // Buscar la orden asociada
        const order = await this.ordersRepository.findOne({
            where: { transactionId: orderId },
            relations: ['user']
        });

        if (!order) {
            throw new NotFoundException(`Orden no encontrada para PayPal orderId: ${orderId}`);
        }

        if (captureResult.status === 'COMPLETED') {
            await this.completeOrderAndSendEmails(order, orderId);
        } else {
            order.status = OrderStatus.FAILED;
            await this.ordersRepository.save(order);
        }

        return {
            status: order.status,
            orderId: order.id,
            details: captureResult
        };
    }
}
