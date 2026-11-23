export type SearchOption = {
    value: string;
    label: string;
};

export type SearchQuestion = {
    id: string;
    title: string;
    options: SearchOption[];
};

export type SearchCategory = {
    name: string;
    hint: string;
    icon: string;
};

export type SearchPack = {
    questions: SearchQuestion[];
    categories: SearchCategory[];
};

/** Пачка первой страницы. На экране виден один вопрос. */
export const SEARCH_PACK: SearchPack = {
    questions: [
        {
            id: 'purpose',
            title: 'Для чего нужен товар?',
            options: [
                { value: 'home', label: 'Для себя' },
                { value: 'cafe', label: 'Для кафе или производства' },
                { value: 'resale', label: 'Для перепродажи' },
            ],
        },
        {
            id: 'volume',
            title: 'Какой объём партии вам нужен?',
            options: [
                { value: 'under_100', label: 'До 100 шт.' },
                { value: '100_500', label: '100–500 шт.' },
                { value: 'over_500', label: 'Более 500 шт.' },
            ],
        },
        {
            id: 'city',
            title: 'Куда везти партию?',
            options: [
                { value: 'moscow', label: 'Москва' },
                { value: 'spb', label: 'Санкт-Петербург' },
                { value: 'other', label: 'Другой город' },
            ],
        },
        {
            id: 'sample',
            title: 'Нужен образец до партии?',
            options: [
                { value: 'yes', label: 'Да, сначала образец' },
                { value: 'no', label: 'Нет, сразу партия' },
            ],
        },
        {
            id: 'deadline',
            title: 'Какой срок поставки приемлем?',
            options: [
                { value: 'fast', label: 'До 3 недель' },
                { value: 'month', label: 'Около месяца' },
                { value: 'flex', label: 'Срок не критичен' },
            ],
        },
    ],
    categories: [
        {
            name: 'Красота и здоровье',
            hint: 'Косметика, парфюм, уход, бытовая химия, аптека',
            icon: 'drop',
        },
        {
            name: 'Блюда и выпечка',
            hint: 'Блюда кафе и ресторанов, выпечка, торты, десерты',
            icon: 'fork',
        },
        {
            name: 'Продукты и напитки',
            hint: 'Фасованные продукты, сладости, чай, кофе, напитки',
            icon: 'basket',
        },
        {
            name: 'Электроника и техника',
            hint: 'Гаджеты, аксессуары к телефонам, бытовая техника',
            icon: 'phone',
        },
        {
            name: 'Дом и интерьер',
            hint: 'Мебель, декор, текстиль, посуда, свет',
            icon: 'sofa',
        },
    ],
};
