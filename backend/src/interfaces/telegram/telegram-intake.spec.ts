import { telegramIntake } from './telegram-intake';

describe('telegramIntake', () => {
    it('без токена бот выключен', () => {
        expect(telegramIntake({ token: '  ', polling: undefined, webhookUrl: undefined })).toBe('off');
    });

    it('без webhook URL выбирает long polling', () => {
        expect(telegramIntake({ token: 'token', polling: undefined, webhookUrl: '  ' })).toBe('poll');
    });

    it('заданный webhook URL не запускает polling', () => {
        expect(telegramIntake({ token: 'token', polling: undefined, webhookUrl: 'https://example.test/hook' })).toBe(
            'webhook',
        );
    });

    it('одноразовая команда не опрашивает Telegram', () => {
        expect(telegramIntake({ token: 'token', polling: 'false', webhookUrl: undefined })).toBe('skip');
    });
});
