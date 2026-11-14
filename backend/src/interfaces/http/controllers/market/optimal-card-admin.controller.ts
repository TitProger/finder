import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';

import {
    OPTIMAL_CARD_SERVICE,
    OptimalCardService,
} from '../../../../application/services/contracts/market/optimal-card.service';
import { ContactChannel } from '../../../../domain/enums/contact-channel.enum';
import type { OptimalCard } from '../../generated/common';
import type { CreateOptimalCardRequest, UpdateOptimalCardRequest } from '../../generated/requests/optimal-cards';
import { OptimalCardMapper } from '../../mappers/market/optimal-card.mapper';

@Controller('admin/optimal-cards')
export class OptimalCardAdminController {
    constructor(
        @Inject(OPTIMAL_CARD_SERVICE)
        private readonly cards: OptimalCardService,
    ) {}

    @Post()
    async create(@Body() body: CreateOptimalCardRequest): Promise<OptimalCard> {
        const card = await this.cards.create({
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
    async update(@Param('id') id: string, @Body() body: UpdateOptimalCardRequest): Promise<OptimalCard> {
        const card = await this.cards.update(id, {
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

function toDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    return new Date(value);
}
