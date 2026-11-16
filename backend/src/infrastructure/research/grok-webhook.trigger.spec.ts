import { RESEARCH_TRIGGER_HEADER, ResearchTriggerBody } from '../../application/ports/research-trigger.port';
import { GrokWebhookTrigger } from './grok-webhook.trigger';

const BODY: ResearchTriggerBody = {
    type: 'finder.research.requested',
    inquiry_id: 'inquiry',
    run_id: 'run',
    requested_at: '2026-11-16T04:00:00.000Z',
    category_code: 'clothing',
    category_name: 'Одежда',
    pack_code: null,
    raw_text: 'куртка',
    answers: [],
    sites: [],
    ingest_url: 'http://localhost/research/ingest',
};

describe('GrokWebhookTrigger', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('шлёт Authorization Bearer и старый заголовок, обрезая секрет', async () => {
        const seen: Record<string, string>[] = [];

        global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            seen.push((init?.headers ?? {}) as Record<string, string>);

            return { ok: true, status: 200 } as Response;
        });

        const result = await new GrokWebhookTrigger().send('https://routine.example/hook', '  key-1\n', BODY);

        expect(result).toEqual({ ok: true, status: 200, error: null });
        expect(seen).toEqual([
            {
                'content-type': 'application/json',
                [RESEARCH_TRIGGER_HEADER]: 'key-1',
                authorization: 'Bearer key-1',
            },
        ]);
        expect(JSON.stringify(seen)).not.toContain('key-1\n');
    });

    it('не удваивает уже записанный префикс Bearer', async () => {
        const seen: Record<string, string>[] = [];

        global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            seen.push((init?.headers ?? {}) as Record<string, string>);

            return { ok: false, status: 401 } as Response;
        });

        const result = await new GrokWebhookTrigger().send('https://routine.example/hook', 'Bearer  key-1  ', BODY);

        expect(result).toEqual({ ok: false, status: 401, error: 'HTTP 401' });
        expect(result.error).not.toContain('key-1');
        expect(seen[0]?.authorization).toBe('Bearer key-1');
        expect(seen[0]?.[RESEARCH_TRIGGER_HEADER]).toBe('Bearer  key-1');
    });

    it('без секрета не ставит заголовки авторизации и не пишет секрет в ошибку сети', async () => {
        global.fetch = jest.fn(async () => {
            throw new Error('network down');
        });

        const result = await new GrokWebhookTrigger().send('https://routine.example/hook', ' \n ', BODY);

        expect(result).toEqual({ ok: false, status: null, error: 'network down' });
        const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
        const headers = init.headers as Record<string, string>;

        expect(headers.authorization).toBeUndefined();
        expect(headers[RESEARCH_TRIGGER_HEADER]).toBeUndefined();
    });
});
