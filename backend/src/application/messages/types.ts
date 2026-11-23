/** Успешное сообщение ответа API. */
export type AppMessage = string;

export function appMessage(message: string): AppMessage {
    return message;
}
