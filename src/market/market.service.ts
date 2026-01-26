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
        if (paymentDetails.status === 'approved' && order.status !== OrderStatus.COMPLETED) {
            console.log(`[MarketService] Payment ${paymentId} approved. Completing order ${order.orderNumber}`);

            order.status = OrderStatus.COMPLETED;
            order.paidAt = new Date();
            order.transactionId = paymentId;
            await this.ordersRepository.save(order);

            // Send confirmation emails (re-using existing logic)
            // Note: This logic is a bit long, in a real refactor I'd move this to a private method
            // but for now I'll keep it simple to ensure it works exactly like before.
            try {
                const items = order.metadata?.items as { productId: string; quantity: number }[] || [];
                const productsInfo: { name: string; quantity: number; price: number, isDigital: boolean, link?: string }[] = [];

                for (const item of items) {
                    const product = await this.productsRepository.findOne({ where: { id: item.productId }, relations: ['prices'] });
                    if (product) {
                        const price = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                        const isDigital = ['pdf', 'digital_file', 'video', 'ebook', 'template'].includes(product.productType);
                        const productLink = product.fileUrl || (product.metadata as any)?.link;

                        productsInfo.push({
                            name: product.name,
                            quantity: item.quantity,
                            price: Number(price),
                            isDigital: isDigital,
                            link: productLink
                        });
                    }
                }

                // Generar Boleta Lioren
                let boletaAttachments: any[] = [];
                try {
                    const userRut = order.metadata?.userRut || this.configService.get<string>('LIOREN_DEFAULT_RUT') || '111111111';

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
                            exento: p.isDigital
                        })),
                        {
                            fechaPago: order.paidAt || new Date(),
                            referencia: order.orderNumber,
                        }
                    );

                    if (boletaResult && boletaResult.pdf) {
                        boletaAttachments.push({
                            filename: `boleta_${order.orderNumber}.pdf`,
                            content: boletaResult.pdf,
                        });
                    }
                } catch (liorenError) {
                    console.error("Error generating Lioren boleta for market order (MP Webhook):", liorenError);
                }

                // Enviar correos
                for (const p of productsInfo) {
                    if (p.link) {
                        await this.marketingService.sendDigitalProductEmail(
                            order.billingEmail,
                            order.user?.name || 'Cliente',
                            p.name,
                            p.link,
                            order.orderNumber,
                            boletaAttachments
                        );
                    }
                }

                await this.marketingService.sendPurchaseConfirmationEmail(
                    order.billingEmail,
                    order.user?.name || 'Cliente',
                    order.orderNumber,
                    productsInfo.map(p => ({ name: p.name, quantity: p.quantity, price: p.price })),
                    Number(order.total),
                    boletaAttachments
                );

            } catch (error) {
                console.error("Error processing emails after MP Webhook success:", error);
            }
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

        const orderUser = await this.getOrCreateUser(user, guestDetails);

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
        if (response.status === 'AUTHORIZED' && response.response_code === 0) {
            order.status = OrderStatus.COMPLETED;
            order.paidAt = new Date();
            order.transactionId = token;

            await this.ordersRepository.save(order);

            // Send confirmation emails
            try {
                const items = order.metadata?.items as { productId: string; quantity: number }[] || [];
                const productsInfo: { name: string; quantity: number; price: number, isDigital: boolean, link?: string }[] = [];

                // Cargar info de productos primero
                for (const item of items) {
                    const product = await this.productsRepository.findOne({ where: { id: item.productId }, relations: ['prices'] });
                    if (product) {
                        const price = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                        const isDigital = ['pdf', 'digital_file', 'video', 'ebook', 'template'].includes(product.productType);
                        const productLink = product.fileUrl || (product.metadata as any)?.link;

                        productsInfo.push({
                            name: product.name,
                            quantity: item.quantity,
                            price: price,
                            isDigital: isDigital,
                            link: productLink
                        });
                    }
                }

                // Generar Boleta Lioren ANTES de enviar emails para poder adjuntarla
                let boletaAttachments: any[] = [];
                try {
                    // El RUT y otros datos podrían estar en order.metadata si se capturaron en el checkout
                    const userRut = order.metadata?.userRut || this.configService.get<string>('LIOREN_DEFAULT_RUT') || '111111111';

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
                            exento: p.isDigital
                        })),
                        {
                            fechaPago: order.paidAt || new Date(),
                            referencia: order.orderNumber,
                        }
                    );

                    if (boletaResult && boletaResult.pdf) {
                        boletaAttachments.push({
                            filename: `boleta_${order.orderNumber}.pdf`,
                            content: boletaResult.pdf,
                        });
                    }
                } catch (liorenError) {
                    console.error("Error generating Lioren boleta for market order:", liorenError);
                }

                // Enviar correos de productos digitales
                for (const p of productsInfo) {
                    if (p.link) {
                        await this.marketingService.sendDigitalProductEmail(
                            order.billingEmail,
                            order.user?.name || 'Cliente',
                            p.name,
                            p.link,
                            order.orderNumber,
                            boletaAttachments
                        );
                    }
                }

                // Enviar confirmación general
                await this.marketingService.sendPurchaseConfirmationEmail(
                    order.billingEmail,
                    order.user?.name || 'Cliente',
                    order.orderNumber,
                    productsInfo.map(p => ({ name: p.name, quantity: p.quantity, price: p.price })),
                    Number(order.total),
                    boletaAttachments
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

    async createMercadoPagoCheckout(
        user: User | undefined,
        items: { productId: string; quantity: number }[],
        creatorSlug: string,
        guestDetails?: { name: string; email: string }
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

        const order = this.ordersRepository.create({
            user: orderUser,
            orderNumber: `ORD-MP-${Date.now()}`,
            status: OrderStatus.PENDING,
            subtotal: totalCLP,
            total: totalCLP,
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

        const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
        const preference = await this.mercadoPagoService.createPaymentPreference({
            amount: totalCLP,
            currency: 'CLP',
            description: `Compra en ${creatorSlug}: ${productsNames.join(', ')}`,
            externalReference: order.id,
            returnUrl: `${appUrl}/market/${creatorSlug}/checkout/validate?paymentProvider=mercadopago`,
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
            order.status = OrderStatus.COMPLETED;
            order.paidAt = new Date();
            order.transactionId = paymentId; // Guardar el ID del pago real
            await this.ordersRepository.save(order);

            // Enviar correos y generar boleta (reutilizando lógica)
            try {
                const items = order.metadata?.items as { productId: string; quantity: number }[] || [];
                const productsInfo: { name: string; quantity: number; price: number, isDigital: boolean, link?: string }[] = [];

                for (const item of items) {
                    const product = await this.productsRepository.findOne({ where: { id: item.productId }, relations: ['prices'] });
                    if (product) {
                        const price = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                        const isDigital = ['pdf', 'digital_file', 'video', 'ebook', 'template'].includes(product.productType);
                        const productLink = product.fileUrl || (product.metadata as any)?.link;

                        productsInfo.push({
                            name: product.name,
                            quantity: item.quantity,
                            price: Number(price),
                            isDigital: isDigital,
                            link: productLink
                        });
                    }
                }

                // Generar Boleta Lioren
                let boletaAttachments: any[] = [];
                try {
                    const userRut = order.metadata?.userRut || this.configService.get<string>('LIOREN_DEFAULT_RUT') || '111111111';

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
                            exento: p.isDigital
                        })),
                        {
                            fechaPago: order.paidAt || new Date(),
                            referencia: order.orderNumber,
                        }
                    );

                    if (boletaResult && boletaResult.pdf) {
                        boletaAttachments.push({
                            filename: `boleta_${order.orderNumber}.pdf`,
                            content: boletaResult.pdf,
                        });
                    }
                } catch (liorenError) {
                    console.error("Error generating Lioren boleta for market order (MP):", liorenError);
                }

                // Enviar correos
                for (const p of productsInfo) {
                    if (p.link) {
                        await this.marketingService.sendDigitalProductEmail(
                            order.billingEmail,
                            order.user?.name || 'Cliente',
                            p.name,
                            p.link,
                            order.orderNumber,
                            boletaAttachments
                        );
                    }
                }

                await this.marketingService.sendPurchaseConfirmationEmail(
                    order.billingEmail,
                    order.user?.name || 'Cliente',
                    order.orderNumber,
                    productsInfo.map(p => ({ name: p.name, quantity: p.quantity, price: p.price })),
                    Number(order.total),
                    boletaAttachments
                );

            } catch (error) {
                console.error("Error processing emails after Mercado Pago success:", error);
            }
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
        guestDetails?: { name: string; email: string }
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
        const totalUSD = parseFloat((totalCLP / exchangeRate).toFixed(2));

        const order = this.ordersRepository.create({
            user: orderUser,
            orderNumber: `ORD-PP-${Date.now()}`,
            status: OrderStatus.PENDING,
            subtotal: totalCLP,
            total: totalCLP,
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

        const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
        const paypalOrder = await this.payPalService.createOrder({
            amount: totalUSD,
            currency: 'USD',
            returnUrl: `${appUrl}/market/${creatorSlug}/checkout/validate?paymentProvider=paypal`,
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
            order.status = OrderStatus.COMPLETED;
            order.paidAt = new Date();
            await this.ordersRepository.save(order);

            // Enviar correos y generar boleta
            try {
                const items = order.metadata?.items as { productId: string; quantity: number }[] || [];
                const productsInfo: { name: string; quantity: number; price: number, isDigital: boolean, link?: string }[] = [];

                for (const item of items) {
                    const product = await this.productsRepository.findOne({ where: { id: item.productId }, relations: ['prices'] });
                    if (product) {
                        const price = product.prices.find(p => p.currency === 'CLP')?.amount || 0;
                        const isDigital = ['pdf', 'digital_file', 'video', 'ebook', 'template'].includes(product.productType);
                        const productLink = product.fileUrl || (product.metadata as any)?.link;

                        productsInfo.push({
                            name: product.name,
                            quantity: item.quantity,
                            price: Number(price),
                            isDigital: isDigital,
                            link: productLink
                        });
                    }
                }

                // Generar Boleta Lioren
                let boletaAttachments: any[] = [];
                try {
                    const userRut = order.metadata?.userRut || this.configService.get<string>('LIOREN_DEFAULT_RUT') || '111111111';

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
                            exento: p.isDigital
                        })),
                        {
                            fechaPago: order.paidAt || new Date(),
                            referencia: order.orderNumber,
                        }
                    );

                    if (boletaResult && boletaResult.pdf) {
                        boletaAttachments.push({
                            filename: `boleta_${order.orderNumber}.pdf`,
                            content: boletaResult.pdf,
                        });
                    }
                } catch (liorenError) {
                    console.error("Error generating Lioren boleta for market order (PayPal):", liorenError);
                }

                // Enviar correos
                for (const p of productsInfo) {
                    if (p.link) {
                        await this.marketingService.sendDigitalProductEmail(
                            order.billingEmail,
                            order.user?.name || 'Cliente',
                            p.name,
                            p.link,
                            order.orderNumber,
                            boletaAttachments
                        );
                    }
                }

                await this.marketingService.sendPurchaseConfirmationEmail(
                    order.billingEmail,
                    order.user?.name || 'Cliente',
                    order.orderNumber,
                    productsInfo.map(p => ({ name: p.name, quantity: p.quantity, price: p.price })),
                    Number(order.total),
                    boletaAttachments
                );

            } catch (error) {
                console.error("Error processing emails after PayPal success:", error);
            }
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
