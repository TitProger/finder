export type TelegramIntake = 'off' | 'skip' | 'webhook' | 'poll';

/**
 * Пустой webhook URL — long polling. Явный URL не опрашивает Telegram.
 * TELEGRAM_POLLING=false нужен одноразовым командам, чтобы не открывать второй poll.
 */
export function telegramIntake(input: {
    token: string;
    polling: string | undefined;
    webhookUrl: string | undefined;
}): TelegramIntake {
    if (!input.token.trim()) {
        return 'off';
    }

    const polling = (input.polling ?? '').trim().toLowerCase();

    if (polling === '0' || polling === 'false' || polling === 'off') {
        return 'skip';
    }

    if ((input.webhookUrl ?? '').trim()) {
        return 'webhook';
    }

    return 'poll';
}
