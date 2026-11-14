import { appError } from './types';

export const InquiryErrors = {
    notFound: appError('INQUIRY_NOT_FOUND', 'Заявка не найдена'),
    textEmpty: appError('INQUIRY_TEXT_EMPTY', 'Текст заявки пустой'),
    notAssignable: appError('INQUIRY_NOT_ASSIGNABLE', 'Заявку в этом статусе уже не назначают'),
    clientRole: appError('INQUIRY_CLIENT_ROLE', 'Telegram user id принадлежит не клиенту'),
    categoryFieldsEmpty: appError('INQUIRY_CATEGORY_FIELDS_EMPTY', 'Имя и описание категории не могут быть пустыми'),
    textTooLong: appError('INQUIRY_TEXT_TOO_LONG', 'Текст заявки длиннее 8000 символов'),
    notClient: appError('INQUIRY_NOT_CLIENT', 'Заявка принадлежит другому клиенту'),
    answerEmpty: appError('INQUIRY_ANSWER_EMPTY', 'Ответ пустой'),
    answerNumber: appError('INQUIRY_ANSWER_NUMBER', 'Нужно число'),
    answerBoolean: appError('INQUIRY_ANSWER_BOOLEAN', 'Ответьте да или нет'),
    answerChoice: appError('INQUIRY_ANSWER_CHOICE', 'Выберите один из вариантов'),
    answerNotExpected: appError('INQUIRY_ANSWER_NOT_EXPECTED', 'Сейчас ответ на вопрос не нужен'),
    notRejectable: appError('INQUIRY_NOT_REJECTABLE', 'Категорию сейчас не снять'),
} as const;
