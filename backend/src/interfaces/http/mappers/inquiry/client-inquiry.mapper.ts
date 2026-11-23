import { toClientInquiryStatus } from '../../../../application/services/impls/inquiry/client-inquiry-status';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import type { ClientInquiry } from '../../generated/responses/client-inquiries';

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

/** API ↔ домен для клиентской заявки. Без telegramUserId. */
export class ClientInquiryMapper {
    static toDto(inquiry: InquiryEntity): ClientInquiry {
        const status = toClientInquiryStatus(inquiry.status);

        return {
            id: inquiry.id,
            status: inquiry.status,
            clientStatus: status.clientStatus,
            clientStatusLabel: status.clientStatusLabel,
            rawText: inquiry.rawText,
            mediaIds: inquiry.photoUrls,
            categoryId: inquiry.category?.id ?? null,
            taxonomyNodeId: inquiry.taxonomyNode?.id ?? null,
            isPaused: inquiry.isPaused,
            pauseReason: inquiry.pauseReason ?? null,
            profileJson: inquiry.profileJson ?? null,
            createdAt: inquiry.createdAt.toISOString(),
            updatedAt: toIso(inquiry.updatedAt),
        };
    }
}
