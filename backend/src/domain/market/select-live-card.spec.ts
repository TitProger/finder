import { QuestionAnswerType } from '../enums/question-answer-type.enum';
import { LiveCardAnswer, LiveCardCandidate, selectLiveCard } from './select-live-card';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const FABRIC = 'fabric';
const QTY = 'qty';
const COLOR = 'color';

function answer(partial: Partial<LiveCardAnswer> & Pick<LiveCardAnswer, 'questionId'>): LiveCardAnswer {
    return {
        answerType: QuestionAnswerType.TEXT,
        isRequired: true,
        valueText: 'хлопок',
        valueJson: null,
        ...partial,
    };
}

function card(partial: Partial<LiveCardCandidate> & Pick<LiveCardCandidate, 'id'>): LiveCardCandidate {
    return {
        quantityQuestionId: QTY,
        qtyMin: '10',
        qtyMax: '100',
        productAttributes: { [FABRIC]: 'хлопок' },
        expiresAt: new Date('2026-12-14T12:00:00.000Z'),
        markedLiveAt: new Date('2026-11-01T00:00:00.000Z'),
        isLive: true,
        ...partial,
    };
}

function answers(qty: string, fabric = 'хлопок'): LiveCardAnswer[] {
    return [
        answer({ questionId: FABRIC, valueText: fabric }),
        answer({
            questionId: QTY,
            answerType: QuestionAnswerType.NUMBER,
            valueText: qty,
        }),
        answer({
            questionId: COLOR,
            answerType: QuestionAnswerType.TEXT,
            isRequired: false,
            valueText: 'синий',
        }),
    ];
}

describe('selectLiveCard', () => {
    it('берёт живую карточку, если объём внутри диапазона и обязательный ответ совпал', () => {
        const chosen = selectLiveCard(answers('50'), [card({ id: 'live' })], NOW);

        expect(chosen?.id).toBe('live');
    });

    it('держит границы диапазона включительно и не берёт объём снаружи', () => {
        const live = [card({ id: 'live' })];

        expect(selectLiveCard(answers('10'), live, NOW)?.id).toBe('live');
        expect(selectLiveCard(answers('100'), live, NOW)?.id).toBe('live');
        expect(selectLiveCard(answers('9'), live, NOW)).toBeNull();
        expect(selectLiveCard(answers('101'), live, NOW)).toBeNull();
    });

    it('не берёт карточку с другим обязательным ответом, просроченную и неживую', () => {
        expect(selectLiveCard(answers('50', 'лён'), [card({ id: 'live' })], NOW)).toBeNull();
        expect(
            selectLiveCard(answers('50'), [card({ id: 'old', expiresAt: new Date('2026-11-01T00:00:00.000Z') })], NOW),
        ).toBeNull();
        expect(selectLiveCard(answers('50'), [card({ id: 'off', isLive: false })], NOW)).toBeNull();
        expect(selectLiveCard(answers('50'), [card({ id: 'undated', expiresAt: null })], NOW)).toBeNull();
    });

    it('необязательный ответ не мешает, при двух вилках берётся более узкая', () => {
        const chosen = selectLiveCard(
            answers('50'),
            [card({ id: 'wide', qtyMin: '1', qtyMax: '1000' }), card({ id: 'narrow', qtyMin: '40', qtyMax: '60' })],
            NOW,
        );

        expect(chosen?.id).toBe('narrow');
    });

    it('при равной ширине берёт позже помеченную', () => {
        const chosen = selectLiveCard(
            answers('50'),
            [
                card({ id: 'early', markedLiveAt: new Date('2026-11-01T00:00:00.000Z') }),
                card({ id: 'late', markedLiveAt: new Date('2026-11-10T00:00:00.000Z') }),
            ],
            NOW,
        );

        expect(chosen?.id).toBe('late');
    });
});
