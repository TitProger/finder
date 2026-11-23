import { Inject, Injectable } from '@nestjs/common';

import { AppMessages } from '@/application/messages';
import {
    DOSSIER_SERVICE,
    DossierService,
} from '@/application/services/contracts/market/dossier.service';
import { DossierReviewDecision } from '@/domain/enums/dossier-review-decision.enum';
import { ServiceResult } from '../../../common/service-result.interface';
import type {
    CreateDossierRequest,
    PublishDossierRequest,
    ReviewDossierRequest,
    UpdateDossierRequest,
} from '../../../generated/requests/dossiers';
import type { AdminDossier } from '../../../generated/responses/dossiers';
import type { SafeDossierReport } from '../../../generated/common';
import { DossierMapper } from '../../../mappers/market/dossier.mapper';
import type { SafeDossierReportBody } from '@/domain/market/safe-dossier-report';
import { ContactChannel } from '@/domain/enums/contact-channel.enum';

@Injectable()
export class DossierHttpService {
    constructor(
        @Inject(DOSSIER_SERVICE)
        private readonly dossiers: DossierService,
    ) {}

    async create(body: CreateDossierRequest): Promise<ServiceResult<AdminDossier>> {
        const entity = await this.dossiers.create({
            categoryId: body.categoryId,
            offerId: body.offerId,
            canonicalProductId: body.canonicalProductId,
            nameRu: body.nameRu,
            nameZh: body.nameZh,
            qtyMin: body.qtyMin,
            qtyMax: body.qtyMax,
            quantityQuestionId: body.quantityQuestionId,
            productAttributes: body.productAttributes,
            price: body.price,
            currency: body.currency,
            contactValue: body.contactValue,
            contactChannel: body.contactChannel as ContactChannel | null | undefined,
            contactUrl: body.contactUrl,
            contactAdminEntered: body.contactAdminEntered,
            reasonNote: body.reasonNote,
            matchText: body.matchText,
            publicReport: body.publicReport as SafeDossierReportBody | null | undefined,
        });

        return { data: DossierMapper.toAdmin(entity), message: AppMessages.common.created };
    }

    async getById(id: string): Promise<ServiceResult<AdminDossier>> {
        const entity = await this.dossiers.getById(id);

        return { data: DossierMapper.toAdmin(entity), message: AppMessages.common.fetched };
    }

    async update(id: string, body: UpdateDossierRequest): Promise<ServiceResult<AdminDossier>> {
        const entity = await this.dossiers.update(id, {
            canonicalProductId: body.canonicalProductId,
            nameRu: body.nameRu,
            nameZh: body.nameZh,
            qtyMin: body.qtyMin,
            qtyMax: body.qtyMax,
            quantityQuestionId: body.quantityQuestionId,
            productAttributes: body.productAttributes,
            price: body.price,
            currency: body.currency,
            contactValue: body.contactValue,
            contactChannel: body.contactChannel as ContactChannel | null | undefined,
            contactUrl: body.contactUrl,
            contactAdminEntered: body.contactAdminEntered,
            reasonNote: body.reasonNote,
            matchText: body.matchText,
            publicReport: body.publicReport as SafeDossierReportBody | null | undefined,
        });

        return { data: DossierMapper.toAdmin(entity), message: AppMessages.common.updated };
    }

    async review(id: string, body: ReviewDossierRequest): Promise<ServiceResult<AdminDossier>> {
        const entity = await this.dossiers.review(id, {
            target: body.target,
            decision: body.decision as DossierReviewDecision,
            note: body.note,
        });

        return { data: DossierMapper.toAdmin(entity), message: AppMessages.common.updated };
    }

    async publish(id: string, body?: PublishDossierRequest | null): Promise<ServiceResult<AdminDossier>> {
        const entity = await this.dossiers.publish(id, {
            revalidateAt: body?.revalidateAt ? new Date(body.revalidateAt) : body?.revalidateAt === null ? null : undefined,
            publicReport: body?.publicReport as SafeDossierReportBody | null | undefined,
        });

        return { data: DossierMapper.toAdmin(entity), message: AppMessages.common.updated };
    }

    async getSafeReport(id: string): Promise<ServiceResult<SafeDossierReport>> {
        const report = await this.dossiers.getSafeReport(id, null);

        return { data: DossierMapper.toSafeReport(report), message: AppMessages.common.fetched };
    }

    async getInquiryReport(inquiryId: string): Promise<ServiceResult<SafeDossierReport>> {
        const report = await this.dossiers.getInquiryReport(inquiryId);

        return { data: DossierMapper.toSafeReport(report), message: AppMessages.common.fetched };
    }
}
