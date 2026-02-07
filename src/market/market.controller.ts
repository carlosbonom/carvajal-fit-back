import { Controller, Post, Body, Param } from '@nestjs/common';
import { MarketService } from './market.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';
import { Public } from '../auth/decorators/public.decorator';

@Controller('market')
export class MarketController {
    constructor(private readonly marketService: MarketService) { }

    @Public()
    @Post(':creatorSlug/webpay/create')
    async createWebpayTransaction(
        @CurrentUser() user: User | undefined,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: {
            items: { productId: string; quantity: number }[],
            guestDetails?: { name: string; email: string },
            origin?: string
        }
    ) {
        return this.marketService.createWebpayTransaction(user, body.items, creatorSlug, body.guestDetails, body.origin);
    }

    @Public()
    @Post(':creatorSlug/mercadopago/create')
    async createMercadoPagoCheckout(
        @CurrentUser() user: User | undefined,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: {
            items: { productId: string; quantity: number }[],
            guestDetails?: { name: string; email: string },
            origin?: string
        }
    ) {
        return this.marketService.createMercadoPagoCheckout(user, body.items, creatorSlug, body.guestDetails, body.origin);
    }

    @Public()
    @Post(':creatorSlug/paypal/create')
    async createPayPalOrder(
        @CurrentUser() user: User | undefined,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: {
            items: { productId: string; quantity: number }[],
            guestDetails?: { name: string; email: string },
            origin?: string
        }
    ) {
        return this.marketService.createPayPalOrder(user, body.items, creatorSlug, body.guestDetails, body.origin);
    }

    @Public()
    @Post(':creatorSlug/webpay/validate')
    async validateWebpay(
        @Body() body: { token: string },
        @Param('creatorSlug') creatorSlug: string
    ) {
        return this.marketService.validateWebpayTransaction(body.token, creatorSlug);
    }

    @Public()
    @Post(':creatorSlug/paypal/validate')
    async validatePayPal(
        @Body() body: { orderId: string },
        @Param('creatorSlug') creatorSlug: string
    ) {
        return this.marketService.validatePayPalTransaction(body.orderId, creatorSlug);
    }

    @Public()
    @Post(':creatorSlug/mercadopago/validate')
    async validateMercadoPago(
        @Body() body: { payment_id: string, status: string, external_reference: string },
        @Param('creatorSlug') creatorSlug: string
    ) {
        return this.marketService.validateMercadoPagoTransaction(body.payment_id, creatorSlug);
    }
}
