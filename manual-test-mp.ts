import { MercadoPagoService } from './src/subscriptions/mercado-pago.service';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService
const mockConfigService = {
    get: (key: string) => {
        if (key === 'MERCADO_PAGO_ACCESS_TOKEN') {
            return 'TEST-7212593378243672-092412-1385bddde1fe45bf0a472fd6e25f3f98-274687249';
        }
        if (key === 'MERCADO_PAGO_WEBHOOK_SECRET') return 'secret';
        return '';
    }
} as unknown as ConfigService;

async function run() {
    const service = new MercadoPagoService(mockConfigService);

    const uniqueRef = `test_ref_${Date.now()}`;
    console.log(`Testing with External Reference: ${uniqueRef}`);

    const data = {
        planId: 'plan_test_id',
        planName: 'CLUB CARVAJAL FIT TEST',
        amount: 1000,
        currency: 'CLP',
        billingCycleSlug: 'mensual',
        intervalType: 'month' as const, // Cast to expected type
        intervalCount: 1,
        // Constructing email based on the username pattern provided by the user
        payerEmail: 'TESTUSER4786744131036751984@testuser.com',
        paymentMethodId: null,
        payerFirstName: 'Test',
        payerLastName: 'User',
        externalReference: uniqueRef,
        backUrl: 'https://carvajalfit.com/subscriptions/callback'
    };

    try {
        console.log('Sending request to Mercado Pago...');
        const result = await service.createSubscription(data);
        console.log('=== SUCCESS ===');
        console.log('Init Point:', result.initPoint || result.sandboxInitPoint);
        console.log('ID:', result.id);
        console.log('Status:', result.status);
        console.log('Full Response:', JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error('=== FAILED ===');
        console.error('Error Message:', error.message);
        console.error('Response Data:', error.response?.data);
    }
}

run();
