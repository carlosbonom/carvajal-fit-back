import { Controller, Post, Body, UseGuards, Param, Req } from '@nestjs/common';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';

@Controller('market')
export class MarketController {
    constructor(private readonly marketService: MarketService) { }

    @Post(':creatorSlug/webpay/create')
    async createWebpayTransaction(
        @CurrentUser() user: User | undefined,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: {
            items: { productId: string; quantity: number }[],
            guestDetails?: { name: string; email: string }
        }
    ) {
        return this.marketService.createWebpayTransaction(user, body.items, creatorSlug, body.guestDetails);
    }

    @Post(':creatorSlug/mercadopago/create')
    async createMercadoPagoCheckout(
        @CurrentUser() user: User | undefined,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: { items: { productId: string; quantity: number }[] }
    ) {
        return this.marketService.createMercadoPagoCheckout(user, body.items, creatorSlug);
    }

    @Post(':creatorSlug/paypal/create')
    async createPayPalOrder(
        @CurrentUser() user: User | undefined,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: { items: { productId: string; quantity: number }[] }
    ) {
        return this.marketService.createPayPalOrder(user, body.items, creatorSlug);
    }

    @Post(':creatorSlug/webpay/validate')
    async validateWebpay(
        @Body() body: { token: string },
        @Param('creatorSlug') creatorSlug: string
    ) {
        return this.marketService.validateWebpayTransaction(body.token, creatorSlug);
    }
}
