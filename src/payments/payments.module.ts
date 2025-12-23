import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebpayService } from './webpay.service';
import { MercadoPagoCheckoutService } from './mercado-pago-checkout.service';
import { PayPalService } from './paypal.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        WebpayService,
        MercadoPagoCheckoutService,
        PayPalService
    ],
    exports: [
        WebpayService,
        MercadoPagoCheckoutService,
        PayPalService
    ],
})
export class PaymentsModule { }
