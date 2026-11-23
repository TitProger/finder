import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { toClientInquiryStatus } from './client-inquiry-status';

describe('toClientInquiryStatus', () => {
    it('даёт честные подписи без процентов', () => {
        expect(toClientInquiryStatus(InquiryStatus.QUEUED_RESEARCH)).toEqual({
            clientStatus: 'submitted',
            clientStatusLabel: 'Заявка в очереди',
        });
        expect(toClientInquiryStatus(InquiryStatus.RESEARCHING)).toEqual({
            clientStatus: 'searching',
            clientStatusLabel: 'Идёт поиск',
        });
        expect(toClientInquiryStatus(InquiryStatus.DOSSIER_WITH_ADMIN)).toEqual({
            clientStatus: 'partial',
            clientStatusLabel: 'Частичный результат',
        });
        expect(toClientInquiryStatus(InquiryStatus.AWAITING_CATEGORY)).toEqual({
            clientStatus: 'needs_clarification',
            clientStatusLabel: 'Нужны уточнения',
        });
        expect(Object.values(InquiryStatus)).toEqual(
            expect.not.arrayContaining(['LIMIT_EXCEEDED']),
        );

        const labels = Object.values(InquiryStatus).map((status) => toClientInquiryStatus(status).clientStatusLabel);

        expect(labels.join(' ')).not.toMatch(/%|\d{2,3}\s*%/);
    });
});
