import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';

import {
    INQUIRY_ECONOMICS,
    InquiryEconomicsService,
} from '../../../../application/services/impls/market/inquiry-economics.service';
import { EconomicsInput } from '../../../../domain/market/layer-prices';

/**
 * Экономика заявки для менеджера. Статический ADMIN_API_TOKEN достаточен.
 * Ответ с ценой не уходит клиенту: это админский маршрут.
 */
@Controller('admin/inquiries')
export class InquiryEconomicsController {
    constructor(
        @Inject(INQUIRY_ECONOMICS)
        private readonly economics: InquiryEconomicsService,
    ) {}

    @Get(':id/economics')
    async view(@Param('id') id: string) {
        return this.economics.view(id);
    }

    @Post(':id/economics')
    @HttpCode(200)
    async save(@Param('id') id: string, @Body() body: EconomicsInput) {
        return this.economics.save(id, {
            deliveryPerUnit: Number(body.deliveryPerUnit),
            dutyPercent: Number(body.dutyPercent),
            otherCost: body.otherCost === undefined || body.otherCost === null ? 0 : Number(body.otherCost),
            markupPercent: Number(body.markupPercent),
        });
    }
}
