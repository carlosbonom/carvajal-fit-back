import { Controller, Get } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Public } from '../auth/decorators/public.decorator';
import { SubscriptionPlansResponseDto } from './dto/subscription-plan-response.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  async getAvailablePlans(): Promise<SubscriptionPlansResponseDto> {
    const plans = await this.subscriptionsService.getAvailablePlans();
    return { plans };
  }
}

