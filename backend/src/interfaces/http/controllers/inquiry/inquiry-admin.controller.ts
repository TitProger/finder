import { Body, Controller, Inject, Param, Post } from '@nestjs/common';

import { INQUIRY_SERVICE, InquiryService } from '../../../../application/services/contracts/inquiry/inquiry.service';
import type { AssignCategoryRequest, CreateCategoryAndAssignRequest } from '../../generated/requests/inquiries';
import type { Inquiry } from '../../generated/responses/inquiries';
import { InquiryMapper } from '../../mappers/inquiry/inquiry.mapper';

/**
 * Назначение категории. Статический ADMIN_API_TOKEN достаточен:
 * автор берётся из админов Telegram, если в запросе нет отдельного пользователя.
 */
@Controller('admin/inquiries')
export class InquiryAdminController {
    constructor(
        @Inject(INQUIRY_SERVICE)
        private readonly inquiries: InquiryService,
    ) {}

    @Post(':id/assign-category')
    async assignCategory(@Param('id') id: string, @Body() body: AssignCategoryRequest): Promise<Inquiry> {
        const view = await this.inquiries.assignCategory({
            inquiryId: id,
            categoryId: body.categoryId,
        });

        return InquiryMapper.toInquiry(view);
    }

    @Post(':id/assign-new-category')
    async createCategoryAndAssign(
        @Param('id') id: string,
        @Body() body: CreateCategoryAndAssignRequest,
    ): Promise<Inquiry> {
        const view = await this.inquiries.createCategoryAndAssign({
            inquiryId: id,
            name: body.name,
            description: body.description,
        });

        return InquiryMapper.toInquiry(view);
    }
}
