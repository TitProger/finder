import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AppErrors } from '../../../../application/errors';
import { INQUIRY_SERVICE, InquiryService } from '../../../../application/services/contracts/inquiry/inquiry.service';
import { UnauthorizedAppException } from '../../../../common/exceptions/unauthorized.exception';
import type { AssignCategoryRequest, CreateCategoryAndAssignRequest } from '../../generated/requests/inquiries';
import type { Inquiry } from '../../generated/responses/inquiries';
import { AuthUser } from '../../auth/jwt-auth.guard';
import { InquiryMapper } from '../../mappers/inquiry/inquiry.mapper';

type RequestWithUser = FastifyRequest & { user?: AuthUser };

@Controller('admin/inquiries')
export class InquiryAdminController {
    constructor(
        @Inject(INQUIRY_SERVICE)
        private readonly inquiries: InquiryService,
    ) {}

    @Post(':id/assign-category')
    async assignCategory(
        @Param('id') id: string,
        @Body() body: AssignCategoryRequest,
        @Req() request: RequestWithUser,
    ): Promise<Inquiry> {
        const view = await this.inquiries.assignCategory({
            inquiryId: id,
            categoryId: body.categoryId,
            adminUserId: adminId(request),
        });

        return InquiryMapper.toInquiry(view);
    }

    @Post(':id/assign-new-category')
    async createCategoryAndAssign(
        @Param('id') id: string,
        @Body() body: CreateCategoryAndAssignRequest,
        @Req() request: RequestWithUser,
    ): Promise<Inquiry> {
        const view = await this.inquiries.createCategoryAndAssign({
            inquiryId: id,
            adminUserId: adminId(request),
            name: body.name,
            description: body.description,
        });

        return InquiryMapper.toInquiry(view);
    }
}

function adminId(request: RequestWithUser): string {
    if (!request.user?.id) {
        throw new UnauthorizedAppException(AppErrors.auth.unauthorized.message, {
            code: AppErrors.auth.unauthorized.code,
        });
    }

    return request.user.id;
}
