import { partitionOffers } from './partition-offers';

describe('partitionOffers', () => {
    it('оставляет оффер с http url и цитатой и отбрасывает пустые', () => {
        const result = partitionOffers([
            { source_url: '  https://detail.1688.com/offer/1.html  ', quote: '100件起' },
            { price: 38.5, quote: 'без адреса' },
            { source_url: 'https://detail.1688.com/offer/2.html', price: 10 },
            { source_url: 'ftp://files.example/a', quote: 'цитата' },
            'мусор',
        ]);

        expect(result.kept).toHaveLength(1);
        expect(result.kept[0]?.sourceUrl).toBe('https://detail.1688.com/offer/1.html');
        expect(result.kept[0]?.quote).toBe('100件起');
        expect(result.discarded.map((item) => `${item.path}: ${item.reason}`)).toEqual([
            'offers[1]: нет source_url',
            'offers[2]: нет quote',
            'offers[3]: source_url не http(s)',
            'offers[4]: нет source_url',
        ]);
    });

    it('отбрасывает url длиннее колонки', () => {
        const result = partitionOffers([
            { source_url: `https://example.com/${'a'.repeat(2048)}`, quote: 'цитата' },
        ]);

        expect(result.kept).toHaveLength(0);
        expect(result.discarded[0]?.reason).toBe('source_url длиннее 2048 символов');
    });
});
