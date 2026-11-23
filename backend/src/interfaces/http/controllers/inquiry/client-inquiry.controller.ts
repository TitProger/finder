import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { Public } from '../../auth/public.decorator';
import type { CreateClientInquiryRequest } from '../../generated/requests/client-inquiries';
import { ClientInquiryHttpService } from '../../services/impls/inquiry/client-inquiry.http-service';

/**
 * Клиентская заявка сайта. Без админского токена и без telegramUserId.
 */
@Public()
@Controller('client/inquiries')
export class ClientInquiryController {
    constructor(private readonly inquiries: ClientInquiryHttpService) {}

    @Public()
    @Post()
    create(@Body() body: CreateClientInquiryRequest) {
        return this.inquiries.create(body);
    }

    @Public()
    @Get(':id/report')
    getReport(@Param('id', ParseUUIDPipe) id: string) {
        return this.inquiries.getReport(id);
    }

    @Public()
    @Get(':id')
    getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.inquiries.getById(id);
    }
}
