import { DossierReviewDecision } from '../enums/dossier-review-decision.enum';
import { QuestionAnswerType } from '../enums/question-answer-type.enum';
import { LiveDossierCandidate, selectLiveDossier } from './select-live-dossier';

const NOW = new Date('2026-11-23T10:00:00.000Z');

function dossier(partial: Partial<LiveDossierCandidate> & Pick<LiveDossierCandidate, 'id'>): LiveDossierCandidate {
    return {
        id: partial.id,
        quantityQuestionId: partial.quantityQuestionId ?? 'qty',
        qtyMin: partial.qtyMin ?? '10',
        qtyMax: partial.qtyMax ?? '100',
        productAttributes: partial.productAttributes ?? {},
        expiresAt: partial.expiresAt ?? new Date('2026-12-23T00:00:00.000Z'),
        markedLiveAt: partial.markedLiveAt ?? new Date('2026-11-01T00:00:00.000Z'),
        isLive: partial.isLive ?? true,
        matchText: partial.matchText ?? 'кофемолка kitfort',
        categoryReview: partial.categoryReview ?? DossierReviewDecision.APPROVED,
        offerReview: partial.offerReview ?? DossierReviewDecision.APPROVED,
        supplierReview: partial.supplierReview ?? DossierReviewDecision.APPROVED,
        hasPublicReport: partial.hasPublicReport ?? true,
    };
}

describe('selectLiveDossier', () => {
    it('берёт точное совпадение по объёму раньше похожего текста', () => {
        const answers = [
            {
                questionId: 'qty',
                answerType: QuestionAnswerType.NUMBER,
                isRequired: true,
                valueText: '50',
                valueJson: 50,
            },
        ];
        const chosen = selectLiveDossier(
            answers,
            'кофемолка',
            [dossier({ id: 'exact', matchText: 'другой товар' })],
            NOW,
        );

        expect(chosen).toEqual({ id: 'exact', kind: 'exact' });
    });

    it('похожий текст обслуживается из live-досье без обязательных ответов', () => {
        const chosen = selectLiveDossier(
            [],
            'Кофемолка Kitfort KT-741',
            [dossier({ id: 'similar', matchText: 'кофемолка kitfort' })],
            NOW,
        );

        expect(chosen).toEqual({ id: 'similar', kind: 'similar' });
    });

    it('не отдаёт досье без review или без public_report', () => {
        expect(
            selectLiveDossier(
                [],
                'кофемолка kitfort',
                [dossier({ id: 'pending', categoryReview: DossierReviewDecision.PENDING })],
                NOW,
            ),
        ).toBeNull();
        expect(
            selectLiveDossier(
                [],
                'кофемолка kitfort',
                [dossier({ id: 'empty', hasPublicReport: false })],
                NOW,
            ),
        ).toBeNull();
    });
});
