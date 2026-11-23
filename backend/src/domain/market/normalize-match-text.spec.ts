import { isSimilarMatchText, normalizeMatchText } from './normalize-match-text';

describe('normalizeMatchText', () => {
    it('сводит регистр и пробелы', () => {
        expect(normalizeMatchText('  Кофемолка, Kitfort!  ')).toBe('кофемолка kitfort');
    });
});

describe('isSimilarMatchText', () => {
    it('считает похожими вложенные нормализованные строки', () => {
        expect(isSimilarMatchText('Кофемолка Kitfort KT-741', 'кофемолка kitfort')).toBe(true);
        expect(isSimilarMatchText('халат', 'умный чайник')).toBe(false);
    });
});
