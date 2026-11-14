import { compareAskedQuestions, isQuestionAsked, selectQuestionPack } from './inquiry-questions';

describe('selectQuestionPack', () => {
    const packs = [
        { id: 'work', code: 'WORKWEAR', title: 'Спецодежда', isActive: true },
        { id: 'summer', code: 'SUMMER', title: 'Лето', isActive: true },
        { id: 'off', code: 'OFF', title: 'Выключен', isActive: false },
    ];

    it('выбирает пакет по точному title или code', () => {
        expect(selectQuestionPack('  спецодежда ', packs)).toBe('work');
        expect(selectQuestionPack('workwear', packs)).toBe('work');
    });

    it('без одного точного совпадения пакет не выбирает и паузу не изображает', () => {
        expect(selectQuestionPack('нужны кроссовки', packs)).toBeNull();
        expect(selectQuestionPack('выключен', packs)).toBeNull();
    });

    it('два точных совпадения не выбирают пакет', () => {
        const duplicated = [...packs, { id: 'other', code: 'спецодежда', title: 'Другое', isActive: true }];

        expect(selectQuestionPack('спецодежда', duplicated)).toBeNull();
    });
});

describe('вопросы категории и пакета', () => {
    it('без пакета отдаёт только базу', () => {
        expect(isQuestionAsked(null, null)).toBe(true);
        expect(isQuestionAsked('work', null)).toBe(false);
    });

    it('с пакетом отдаёт базу и этот пакет', () => {
        expect(isQuestionAsked(null, 'work')).toBe(true);
        expect(isQuestionAsked('work', 'work')).toBe(true);
        expect(isQuestionAsked('summer', 'work')).toBe(false);
    });

    it('сортирует базу раньше вопросов пакета', () => {
        const base = { id: 'b', sortOrder: 5, questionPackId: null };
        const packed = { id: 'p', sortOrder: 0, questionPackId: 'work' };

        expect(compareAskedQuestions(base, packed)).toBeLessThan(0);
        expect(compareAskedQuestions(packed, base)).toBeGreaterThan(0);
    });
});
