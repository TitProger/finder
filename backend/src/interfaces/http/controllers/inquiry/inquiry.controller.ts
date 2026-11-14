import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';

import { INQUIRY_SERVICE, InquiryService } from '../../../../application/services/contracts/inquiry/inquiry.service';
import type { CreateInquiryRequest } from '../../generated/requests/inquiries';
import type { Inquiry } from '../../generated/responses/inquiries';
import { Public } from '../../auth/public.decorator';
import { InquiryMapper } from '../../mappers/inquiry/inquiry.mapper';

@Controller('inquiries')
export class InquiryController {
    constructor(
        @Inject(INQUIRY_SERVICE)
        private readonly inquiries: InquiryService,
    ) {}

    @Public()
    @Post()
    async create(@Body() body: CreateInquiryRequest): Promise<Inquiry> {
        const view = await this.inquiries.create({
            telegramUserId: body.telegramUserId,
            text: body.text,
        });

        return InquiryMapper.toInquiry(view);
    }

    @Public()
    @Get(':id')
    async getById(@Param('id') id: string): Promise<Inquiry> {
        const view = await this.inquiries.getById(id);

        return InquiryMapper.toInquiry(view);
    }
}
