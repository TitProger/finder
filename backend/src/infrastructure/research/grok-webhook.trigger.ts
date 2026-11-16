import { Injectable } from '@nestjs/common';

import {
    RESEARCH_TRIGGER_HEADER,
    ResearchTriggerAttempt,
    ResearchTriggerBody,
    ResearchTriggerPort,
} from '../../application/ports/research-trigger.port';

/**
 * POST в рутину, которая собирает досье.
 * 2xx значит «принято», не «досье готово».
 */
@Injectable()
export class GrokWebhookTrigger implements ResearchTriggerPort {
    async send(url: string, secret: string, body: ResearchTriggerBody): Promise<ResearchTriggerAttempt> {
        try {
            const headers: Record<string, string> = {
                'content-type': 'application/json',
            };
            const auth = authorizationFor(secret);

            if (auth) {
                headers[RESEARCH_TRIGGER_HEADER] = auth.secret;
                headers.authorization = auth.bearer;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (response.ok) {
                return { ok: true, status: response.status, error: null };
            }

            return { ok: false, status: response.status, error: `HTTP ${response.status}` };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'network';

            return { ok: false, status: null, error: message };
        }
    }
}

/**
 * Рутина Grok ждёт `Authorization: Bearer <key>`.
 * Секрет из GitHub может прийти с пробелом или уже с префиксом Bearer.
 */
function authorizationFor(secret: string): { secret: string; bearer: string } | null {
    const trimmed = secret.trim();

    if (!trimmed) {
        return null;
    }

    const token = trimmed.replace(/^bearer\s+/i, '').trim();

    if (!token) {
        return null;
    }

    return { secret: trimmed, bearer: `Bearer ${token}` };
}
