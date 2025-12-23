import { Controller, Post, Body, UseGuards, Param, Req } from '@nestjs/common';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';

@Controller('market')
export class MarketController {
    constructor(private readonly marketService: MarketService) { }

    @Post(':creatorSlug/webpay/create')
    @UseGuards(JwtAuthGuard)
    async createWebpayTransaction(
        @CurrentUser() user: User,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: { items: { productId: string; quantity: number }[] }
    ) {
        return this.marketService.createWebpayTransaction(user, body.items, creatorSlug);
    }

    @Post(':creatorSlug/mercadopago/create')
    @UseGuards(JwtAuthGuard)
    async createMercadoPagoCheckout(
        @CurrentUser() user: User,
        @Param('creatorSlug') creatorSlug: string,
        @Body() body: { items: { productId: string; quantity: number }[] }
    ) {
        return this.marketService.createMercadoPagoCheckout(user, body.items, creatorSlug);
    }

    @Post(':creatorSlug/paypal/create')
    @UseGuards(JwtAuthGuard)
    async createPayPalOrder(
        @CurrentUser() user: User,
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
