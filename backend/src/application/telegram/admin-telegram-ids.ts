import { Envs } from '../../common/envs/env';

/**
 * Список админов. process.env читается в момент вызова, чтобы тест мог подставить ID.
 * Невалидные куски пропускаются: уведомление не должно падать из-за опечатки в списке.
 */
export function adminTelegramIds(): string[] {
    const raw = process.env.ADMIN_TELEGRAM_IDS;

    if (raw === undefined) {
        return [...Envs.admin.telegramIds];
    }

    return raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[1-9]\d{0,18}$/.test(id));
}

export function adminChatIds(): number[] {
    return adminTelegramIds()
        .map((id) => Number(id))
        .filter((id) => Number.isSafeInteger(id));
}
