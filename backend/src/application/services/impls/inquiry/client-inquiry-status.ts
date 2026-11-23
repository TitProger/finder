import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';

export type ClientInquiryStatusCode =
    | 'draft'
    | 'analyzing'
    | 'needs_clarification'
    | 'submitted'
    | 'searching'
    | 'partial'
    | 'ready'
    | 'no_results'
    | 'error'
    | 'can_retry';

export type ClientInquiryStatusView = {
    clientStatus: ClientInquiryStatusCode;
    clientStatusLabel: string;
};

const LABELS: Record<ClientInquiryStatusCode, string> = {
    draft: 'Черновик',
    analyzing: 'Анализ названия и категории',
    needs_clarification: 'Нужны уточнения',
    submitted: 'Заявка в очереди',
    searching: 'Идёт поиск',
    partial: 'Частичный результат',
    ready: 'Готово',
    no_results: 'Нет результатов',
    error: 'Ошибка',
    can_retry: 'Можно повторить',
};

/**
 * Честный статус для панели результатов. Без процентов.
 */
export function toClientInquiryStatus(status: InquiryStatus): ClientInquiryStatusView {
    const clientStatus = mapStatus(status);

    return {
        clientStatus,
        clientStatusLabel: LABELS[clientStatus],
    };
}

function mapStatus(status: InquiryStatus): ClientInquiryStatusCode {
    switch (status) {
        case InquiryStatus.DRAFT:
            return 'draft';
        case InquiryStatus.AWAITING_CATEGORY:
            return 'needs_clarification';
        case InquiryStatus.COLLECTING_ANSWERS:
            return 'analyzing';
        case InquiryStatus.QUEUED_RESEARCH:
            return 'submitted';
        case InquiryStatus.RESEARCHING:
            return 'searching';
        case InquiryStatus.SERVED_FROM_DATABASE:
            return 'ready';
        case InquiryStatus.DOSSIER_WITH_ADMIN:
            return 'partial';
        case InquiryStatus.CLOSED:
            return 'ready';
        default:
            return 'analyzing';
    }
}
