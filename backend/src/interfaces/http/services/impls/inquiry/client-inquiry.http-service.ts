import { Inject, Injectable } from '@nestjs/common';

import { AppMessages } from '@/application/messages';
import {
    CLIENT_INQUIRY_SERVICE,
    ClientInquiryService,
} from '@/application/services/contracts/inquiry/client-inquiry.service';
import { ServiceResult } from '../../../common/service-result.interface';
import type { CreateClientInquiryRequest } from '../../../generated/requests/client-inquiries';
import type { ClientInquiry } from '../../../generated/responses/client-inquiries';
import type { SafeDossierReport } from '../../../generated/common';
import { ClientInquiryMapper } from '../../../mappers/inquiry/client-inquiry.mapper';
import { DossierHttpService } from '../market/dossier.http-service';

@Injectable()
export class ClientInquiryHttpService {
    constructor(
        @Inject(CLIENT_INQUIRY_SERVICE)
        private readonly inquiries: ClientInquiryService,
        private readonly dossiers: DossierHttpService,
    ) {}

    async create(body: CreateClientInquiryRequest): Promise<ServiceResult<ClientInquiry>> {
        const inquiry = await this.inquiries.create({
            text: body.text,
            mediaIds: body.mediaIds,
            taxonomyNodeId: body.taxonomyNodeId ?? null,
            profileJson: (body.profileJson ?? null) as Record<string, unknown> | null,
        });

        return {
            data: ClientInquiryMapper.toDto(inquiry),
            message: AppMessages.common.created,
        };
    }

    async getById(id: string): Promise<ServiceResult<ClientInquiry>> {
        const inquiry = await this.inquiries.getById(id);

        return {
            data: ClientInquiryMapper.toDto(inquiry),
            message: AppMessages.common.fetched,
        };
    }

    getReport(id: string): Promise<ServiceResult<SafeDossierReport>> {
        return this.dossiers.getInquiryReport(id);
    }
}
