import { TelegramOutgoing } from '../../interfaces/telegram/telegram.types';
import { TelegramManagerNotify } from './telegram-manager-notify';

function restore(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];

        return;
    }

    process.env[name] = value;
}

describe('TelegramManagerNotify', () => {
    const previousDelay = process.env.MANAGER_NOTIFY_RETRY_DELAY_MS;
    const previousAttempts = process.env.MANAGER_NOTIFY_MAX_ATTEMPTS;

    beforeEach(() => {
        process.env.MANAGER_NOTIFY_RETRY_DELAY_MS = '0';
        process.env.MANAGER_NOTIFY_MAX_ATTEMPTS = '3';
    });

    afterEach(() => {
        restore('MANAGER_NOTIFY_RETRY_DELAY_MS', previousDelay);
        restore('MANAGER_NOTIFY_MAX_ATTEMPTS', previousAttempts);
    });

    it('повторяет отправку и режет текст длиннее лимита Telegram', async () => {
        const sent: TelegramOutgoing[] = [];
        let failures = 0;
        const notify = new TelegramManagerNotify({
            async deliver(message) {
                if (message.method === 'sendMessage' && failures < 1) {
                    failures += 1;

                    throw new Error('временный сбой');
                }

                sent.push(message);
            },
        });
        const tail = 'КОНЕЦ-СВОДКИ';
        const text = `${'а'.repeat(5000)}\n${tail}`;

        await notify.send(42, text, [[{ text: 'Закрыть', callbackData: 'cl:x' }]]);

        expect(failures).toBe(1);
        expect(sent.length).toBeGreaterThan(1);
        expect(sent.every((item) => item.method === 'sendMessage' && item.text.length <= 4096)).toBe(true);
        expect(sent[0]).toMatchObject({
            method: 'sendMessage',
            buttons: [[{ text: 'Закрыть', callbackData: 'cl:x' }]],
        });
        expect(sent.slice(1).every((item) => item.method === 'sendMessage' && !item.buttons)).toBe(true);
        expect(sent.map((item) => (item.method === 'sendMessage' ? item.text : '')).join('\n')).toContain(tail);
    });
});
