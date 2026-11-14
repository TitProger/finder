import { partitionOffers } from './partition-offers';

describe('partitionOffers', () => {
    it('оставляет оффер с url и отбрасывает пустой', () => {
        const result = partitionOffers([
            { sourceUrl: '  https://detail.1688.com/offer/1.html  ', quoteText: '100件起' },
            { price: 1, quoteText: 'без адреса' },
            { sourceUrl: '   ' },
            'мусор',
        ]);

        expect(result.kept).toHaveLength(1);
        expect(result.kept[0]?.sourceUrl).toBe('https://detail.1688.com/offer/1.html');
        expect(result.discarded.map((item) => item.reason)).toEqual([
            'Оффер 2 отброшен: нет url. Цитата: «без адреса».',
            'Оффер 3 отброшен: нет url.',
            'Оффер 4 отброшен: нет url.',
        ]);
    });

    it('отбрасывает url длиннее колонки', () => {
        const result = partitionOffers([{ sourceUrl: `https://example.com/${'a'.repeat(2048)}` }]);

        expect(result.kept).toHaveLength(0);
        expect(result.discarded[0]?.reason).toBe('Оффер 1 отброшен: url длиннее 2048 символов.');
    });
});
