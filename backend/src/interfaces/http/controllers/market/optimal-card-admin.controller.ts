import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AppErrors } from '../../../../application/errors';
import {
    OPTIMAL_CARD_SERVICE,
    OptimalCardService,
} from '../../../../application/services/contracts/market/optimal-card.service';
import { UnauthorizedAppException } from '../../../../common/exceptions/unauthorized.exception';
import { ContactChannel } from '../../../../domain/enums/contact-channel.enum';
import { AuthUser } from '../../auth/jwt-auth.guard';
import type { OptimalCard } from '../../generated/common';
import type { CreateOptimalCardRequest, UpdateOptimalCardRequest } from '../../generated/requests/optimal-cards';
import { OptimalCardMapper } from '../../mappers/market/optimal-card.mapper';

type RequestWithUser = FastifyRequest & { user?: AuthUser };

@Controller('admin/optimal-cards')
export class OptimalCardAdminController {
    constructor(
        @Inject(OPTIMAL_CARD_SERVICE)
        private readonly cards: OptimalCardService,
    ) {}

    @Post()
    async create(@Body() body: CreateOptimalCardRequest, @Req() request: RequestWithUser): Promise<OptimalCard> {
        const card = await this.cards.create({
            adminUserId: adminId(request),
            categoryId: body.categoryId,
            offerId: body.offerId,
            canonicalProductId: body.canonicalProductId,
            nameRu: body.nameRu,
            nameZh: body.nameZh,
            qtyMin: body.qtyMin,
            qtyMax: body.qtyMax,
            quantityQuestionId: body.quantityQuestionId,
            productAttributes: body.productAttributes,
            isLive: body.isLive ?? false,
            price: body.price,
            currency: body.currency,
            contactValue: body.contactValue,
            contactChannel: body.contactChannel as ContactChannel | null | undefined,
            contactUrl: body.contactUrl,
            contactAdminEntered: body.contactAdminEntered,
            reasonNote: body.reasonNote,
            expiresAt: toDate(body.expiresAt),
        });

        return OptimalCardMapper.toCard(card);
    }

    @Get(':id')
    async getById(@Param('id') id: string): Promise<OptimalCard> {
        return OptimalCardMapper.toCard(await this.cards.getById(id));
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() body: UpdateOptimalCardRequest,
        @Req() request: RequestWithUser,
    ): Promise<OptimalCard> {
        const card = await this.cards.update(id, {
            adminUserId: adminId(request),
            canonicalProductId: body.canonicalProductId,
            nameRu: body.nameRu,
            nameZh: body.nameZh,
            qtyMin: body.qtyMin,
            qtyMax: body.qtyMax,
            quantityQuestionId: body.quantityQuestionId,
            productAttributes: body.productAttributes,
            isLive: body.isLive,
            price: body.price,
            currency: body.currency,
            contactValue: body.contactValue,
            contactChannel: body.contactChannel as ContactChannel | null | undefined,
            contactUrl: body.contactUrl,
            contactAdminEntered: body.contactAdminEntered,
            reasonNote: body.reasonNote,
            expiresAt: toDate(body.expiresAt),
        });

        return OptimalCardMapper.toCard(card);
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

function toDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    return new Date(value);
}
