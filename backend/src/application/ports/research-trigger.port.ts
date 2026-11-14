export const RESEARCH_TRIGGER = Symbol('RESEARCH_TRIGGER');

export const RESEARCH_TRIGGER_HEADER = 'x-research-trigger-secret';

export type ResearchTriggerAnswer = {
    code: string | null;
    prompt: string;
    value: string;
};

export type ResearchTriggerSite = {
    name: string;
    role: string;
    priority: number;
    requires_login: boolean;
    query_template: string | null;
};

/**
 * Тело webhook. Нет Telegram id и нет цен.
 */
export type ResearchTriggerBody = {
    type: 'finder.research.requested';
    inquiry_id: string;
    run_id: string;
    requested_at: string;
    category_code: string;
    category_name: string;
    pack_code: string | null;
    raw_text: string;
    answers: ResearchTriggerAnswer[];
    sites: ResearchTriggerSite[];
    ingest_url: string;
};

export type ResearchTriggerAttempt = {
    ok: boolean;
    status: number | null;
    error: string | null;
};

export interface ResearchTriggerPort {
    send(url: string, secret: string, body: ResearchTriggerBody): Promise<ResearchTriggerAttempt>;
}
