import { SearchedProductDossier } from '../../../../domain/entities/catalog/searched-product.dossier';

export type DemoGalleryItem = {
    path: string;
    alt: string;
};

export type DemoProductSeed = {
    slug: string;
    name: string;
    categoryLabel: string;
    chipLabel: string | null;
    materialCount: number;
    searchedAt: string;
    createdAt: string;
    updatedAt: string;
    article: string | null;
    cover: string;
    gallery: DemoGalleryItem[];
    dossier: Omit<SearchedProductDossier, 'photos'>;
};

const unavailableDelivery: SearchedProductDossier['delivery'] = {
    available: false,
    demo: false,
    title: '2. Доставка',
    modes: [],
    perUnit: null,
    perBatch: null,
    included: [],
};

function plainDossier(
    summary: string,
    specs: { label: string; value: string }[],
): Omit<SearchedProductDossier, 'photos'> {
    return {
        headline: null,
        cardCategoryLabel: null,
        manufacturer: null,
        oemLabel: null,
        summaryTitle: 'Резюме',
        summary,
        availabilityLabel: null,
        demandLabel: null,
        galleryMoreLabel: null,
        verifiedLabel: null,
        updatedLabel: null,
        specsTitle: 'Характеристики и спецификация',
        passportLabel: 'Паспорт изделия',
        specs,
        procurement: null,
        delivery: unavailableDelivery,
        market: null,
        breakdown: null,
    };
}

/**
 * Тексты и числа — фикстура DevStand, не живой ресерч.
 * Пути относительно seed-media/.
 */
export const DEMO_PRODUCTS: DemoProductSeed[] = [
    {
        slug: 'lab-coat',
        name: 'Лабораторный халат',
        categoryLabel: 'Одежда',
        chipLabel: null,
        materialCount: 1,
        searchedAt: '2026-11-21T08:28:00+03:00',
        createdAt: '2026-11-21T08:28:00+03:00',
        updatedAt: '2026-11-21T08:28:00+03:00',
        article: null,
        cover: 'demo/products/lab-coat/cover.svg',
        gallery: [{ path: 'demo/products/lab-coat/cover.svg', alt: 'Лабораторный халат' }],
        dossier: plainDossier('Демо-описание лабораторного халата для истории поиска. Это не результат ресерча.', [
            { label: 'Ткань', value: 'Смесовая, демо' },
            { label: 'Размерный ряд', value: '44–56' },
        ]),
    },
    {
        slug: 'kitfort-kt-741',
        name: 'Кофемолка Kitfort KT-741',
        categoryLabel: 'Электроника и техника',
        chipLabel: 'Электроника',
        materialCount: 4,
        searchedAt: '2026-11-20T14:15:00+03:00',
        createdAt: '2026-11-20T14:15:00+03:00',
        updatedAt: '2026-11-20T14:15:00+03:00',
        article: 'KT-741-BLK',
        cover: 'demo/products/kitfort-kt-741/cover.svg',
        gallery: [
            { path: 'demo/products/kitfort-kt-741/cover.svg', alt: 'Вид спереди' },
            { path: 'demo/products/kitfort-kt-741/burrs.svg', alt: 'Жернова' },
            { path: 'demo/products/kitfort-kt-741/body.svg', alt: 'Корпус' },
        ],
        dossier: {
            headline: 'Кофемолка электрическая Kitfort KT-741',
            cardCategoryLabel: 'Электроника и бытовая техника',
            manufacturer: 'Guangdong Electrical Appliances Ltd.',
            oemLabel: 'OEM / ODM доступен',
            summaryTitle: 'Резюме Finder AI:',
            summary:
                'Оптимальная модель для маркетплейсов с низким процентом брака (0.4%) и высокой маржинальностью. Отличная посадка под бренд-нейминг в РФ.',
            availabilityLabel: 'В наличии у фабрики',
            demandLabel: 'Хит спроса на маркетплейсах',
            galleryMoreLabel: '+3 фото',
            verifiedLabel: 'Проверено Finder AI',
            updatedLabel: 'Обновлено сегодня',
            specsTitle: 'Характеристики и спецификация',
            passportLabel: 'Паспорт изделия',
            specs: [
                { label: 'Тип привода и помола', value: 'Жерновая электрическая (конические)' },
                { label: 'Номинальная мощность', value: '150 Вт (медная обмотка мотора)' },
                { label: 'Вместимость резервуара', value: '250 г зернового кофе' },
                { label: 'Материал жерновов', value: 'Нержавеющая сталь SUS420' },
                { label: 'Степеней помола', value: '31 точный режим (от эспрессо до френч-пресс)' },
                { label: 'Габариты и вес', value: '220 × 140 × 310 мм, 1.85 кг' },
                { label: 'Комплектация фабрики', value: 'Щёточка для чистки, мерный дозатор, инструкция' },
            ],
            procurement: {
                title: '1. Закупка в Китае (Фабрика / 1688)',
                moqLabel: 'Мин. заказ: 100 шт',
                tiers: [
                    {
                        title: 'От партии 500 шт',
                        price: '¥68.00',
                        converted: '~920 ₽ / $10.20',
                        note: 'Фабричная цена FOB',
                        badge: 'Выгодно',
                        highlighted: true,
                    },
                    {
                        title: 'Партия 100–300 шт',
                        price: '¥82.00',
                        converted: '~1 110 ₽ / $12.30',
                        note: 'Базовый опт',
                        highlighted: false,
                    },
                    {
                        title: 'Рекомендуемый заказ',
                        price: '300–500',
                        priceUnit: 'шт',
                        converted: 'Бюджет: от ~380 000 ₽',
                        note: 'Оптимум логистики',
                        highlighted: false,
                    },
                ],
            },
            delivery: {
                available: true,
                demo: true,
                title: '2. Доставка Гуанчжоу → Москва',
                modes: ['Карго быстрая', 'Белая (ГТД)'],
                perUnit: {
                    caption: 'Логистика за 1 шт (при весе 1.85 кг)',
                    price: '340 ₽',
                    priceSuffix: '/ ед. товара',
                    detail: 'Тариф: $1.85 / кг (авто-карго 14–18 дней)',
                },
                perBatch: {
                    caption: 'Доставка всей партии (500 шт)',
                    price: '170 000 ₽',
                    priceSuffix: 'общий вес 925 кг',
                    detail: 'Включено: страховка груза 100%',
                },
                included: ['Жесткая обрешетка и паллеты', 'Страховка от утери и боя', 'Южные Ворота / ТЯК Люблино'],
            },
            market: {
                title: '3. Цены конкурентов в РФ (WB / Ozon / Я.Маркет)',
                sellersLabel: '64 продавца',
                quotes: [
                    { title: 'Мин. розница (демпинг)', price: '2 490 ₽', note: 'Wildberries', highlighted: false },
                    {
                        title: 'Средняя рыночная',
                        price: '3 850 – 4 200 ₽',
                        note: 'Основной объем продаж',
                        highlighted: true,
                    },
                    { title: 'Макс. на полке', price: '5 490 ₽', note: 'Ozon Premium / DNS', highlighted: false },
                ],
            },
            breakdown: {
                title: '4. Юнит-экономика и чистая прибыль',
                verdict: 'Высокая рентабельность',
                stars: 5,
                costPrice: '1 260 ₽',
                costSuffix: '/ шт',
                costNote: 'Товар (920 ₽) + Логистика до склада (340 ₽)',
                profitPrice: '+1 450 ₽',
                profitExtra: '(ROI ~115%)',
                profitNote: 'При розничной цене 3 900 ₽ (с комиссией маркетплейса 18%)',
                saleLabel: 'Структура цены продажи: 3 900 ₽',
                marginLabel: 'Маржа 37.2%',
                segments: [
                    { label: 'Товар', sharePercent: 24, tone: 'product' },
                    { label: 'Логистика', sharePercent: 9, tone: 'logistics' },
                    { label: 'Комиссия MP', sharePercent: 18, tone: 'fee' },
                    { label: 'Фулфилмент', sharePercent: 12, tone: 'fulfillment' },
                    { label: 'Чистая прибыль', sharePercent: 37, tone: 'profit' },
                ],
            },
        },
    },
    {
        slug: 'yandex-station',
        name: 'Умная колонка Яндекс Станция',
        categoryLabel: 'Электроника и техника',
        chipLabel: 'Техника',
        materialCount: 8,
        searchedAt: '2026-11-18T19:40:00+03:00',
        createdAt: '2026-11-18T19:40:00+03:00',
        updatedAt: '2026-11-18T19:40:00+03:00',
        article: null,
        cover: 'demo/products/yandex-station/cover.svg',
        gallery: [{ path: 'demo/products/yandex-station/cover.svg', alt: 'Умная колонка' }],
        dossier: plainDossier('Демо-описание умной колонки. Числа закупки на этой карточке не заполнены.', [
            { label: 'Питание', value: 'Сеть 220 В, демо' },
            { label: 'Связь', value: 'Wi-Fi' },
        ]),
    },
    {
        slug: 'ceramic-teapot',
        name: 'Керамический заварочный чайник',
        categoryLabel: 'Дом и интерьер',
        chipLabel: 'Дом',
        materialCount: 2,
        searchedAt: '2026-11-15T11:02:00+03:00',
        createdAt: '2026-11-15T11:02:00+03:00',
        updatedAt: '2026-11-15T11:02:00+03:00',
        article: null,
        cover: 'demo/products/ceramic-teapot/cover.svg',
        gallery: [{ path: 'demo/products/ceramic-teapot/cover.svg', alt: 'Керамический чайник' }],
        dossier: plainDossier('Демо-описание керамического чайника для сетки истории.', [
            { label: 'Материал', value: 'Керамика' },
            { label: 'Объём', value: '600 мл, демо' },
        ]),
    },
];
