import { Body, Controller, Post } from '@nestjs/common';

import type { LogisticsQuoteRequest, MarginEstimateRequest } from '../../generated/requests/rates';
import { Public } from '../../auth/public.decorator';
import { RatesHttpService } from '../../services/impls/rates/rates.http-service';

/**
 * Публичные калькуляторы. Модель не участвует.
 */
@Public()
@Controller('rates')
export class RatesQuoteController {
    constructor(private readonly rates: RatesHttpService) {}

    @Public()
    @Post('quote')
    quote(@Body() body: LogisticsQuoteRequest) {
        return this.rates.quote(body);
    }

    @Public()
    @Post('margin')
    margin(@Body() body: MarginEstimateRequest) {
        return this.rates.estimateMargin(body);
    }
}
