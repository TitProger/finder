import { appError } from './types';

export const OptimalCardErrors = {
    notFound: appError('OPTIMAL_CARD_NOT_FOUND', 'Оптимальная карточка не найдена'),
    offerNotFound: appError('OPTIMAL_CARD_OFFER_NOT_FOUND', 'Оффер не найден'),
    productNotFound: appError('OPTIMAL_CARD_PRODUCT_NOT_FOUND', 'Товар не найден'),
    productNameRequired: appError('OPTIMAL_CARD_PRODUCT_NAME_REQUIRED', 'Нужно имя товара'),
    productCategory: appError('OPTIMAL_CARD_PRODUCT_CATEGORY', 'Товар не из этой категории'),
    qtyRange: appError('OPTIMAL_CARD_QTY_RANGE', 'Диапазон количества неверный'),
    quantityQuestion: appError(
        'OPTIMAL_CARD_QUANTITY_QUESTION',
        'Вопрос объёма должен быть обязательным числом этой категории',
    ),
    attributes: appError(
        'OPTIMAL_CARD_ATTRIBUTES',
        'В полях товара только обязательные вопросы категории, кроме объёма',
    ),
    currency: appError('OPTIMAL_CARD_CURRENCY', 'Валюта должна быть из трёх букв'),
    price: appError('OPTIMAL_CARD_PRICE', 'Цена не может быть отрицательной'),
    contact: appError('OPTIMAL_CARD_CONTACT', 'Контакт длиннее допустимого'),
    expiry: appError('OPTIMAL_CARD_EXPIRY', 'Дата срока некорректна'),
    liveConflict: appError('OPTIMAL_CARD_LIVE_CONFLICT', 'Живая карточка на этот товар и диапазон уже есть'),
} as const;
