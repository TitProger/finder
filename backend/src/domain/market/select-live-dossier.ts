import { DossierReviewDecision } from '../enums/dossier-review-decision.enum';
import { isSimilarMatchText, normalizeMatchText } from './normalize-match-text';
import { LiveCardAnswer, LiveCardCandidate, selectLiveCard } from './select-live-card';

export type LiveDossierCandidate = LiveCardCandidate & {
    matchText: string | null;
    categoryReview: DossierReviewDecision;
    offerReview: DossierReviewDecision;
    supplierReview: DossierReviewDecision;
    hasPublicReport: boolean;
};

export type LiveDossierMatch = {
    id: string;
    kind: 'exact' | 'similar';
};

/**
 * Живое утверждённое досье для повторного запроса.
 * Exact — как selectLiveCard по обязательным ответам и объёму.
 * Similar — та же категория, похожий matchText, все review approved, есть public_report.
 */
export function selectLiveDossier(
    answers: readonly LiveCardAnswer[],
    queryText: string,
    dossiers: readonly LiveDossierCandidate[],
    now: Date,
): LiveDossierMatch | null {
    const publishable = dossiers.filter((item) => canServe(item, now));

    if (publishable.length === 0) {
        return null;
    }

    const exact = selectLiveCard(answers, publishable, now);

    if (exact) {
        return { id: exact.id, kind: 'exact' };
    }

    const needle = normalizeMatchText(queryText);

    if (!needle) {
        return null;
    }

    const similar = publishable
        .filter((item) => isSimilarMatchText(needle, item.matchText ?? ''))
        .sort((left, right) => {
            const leftScore = scoreSimilarity(needle, left.matchText ?? '');
            const rightScore = scoreSimilarity(needle, right.matchText ?? '');

            if (leftScore !== rightScore) {
                return rightScore - leftScore;
            }

            return (right.markedLiveAt?.getTime() ?? 0) - (left.markedLiveAt?.getTime() ?? 0);
        });

    const chosen = similar[0];

    return chosen ? { id: chosen.id, kind: 'similar' } : null;
}

function canServe(item: LiveDossierCandidate, now: Date): boolean {
    if (!item.isLive || !item.expiresAt || item.expiresAt.getTime() <= now.getTime()) {
        return false;
    }

    if (!item.hasPublicReport) {
        return false;
    }

    return (
        item.categoryReview === DossierReviewDecision.APPROVED &&
        item.offerReview === DossierReviewDecision.APPROVED &&
        item.supplierReview === DossierReviewDecision.APPROVED
    );
}

function scoreSimilarity(needle: string, haystack: string): number {
    const normalized = normalizeMatchText(haystack);

    if (!normalized) {
        return 0;
    }

    if (normalized === needle) {
        return 1000 + normalized.length;
    }

    if (normalized.includes(needle) || needle.includes(normalized)) {
        return Math.min(needle.length, normalized.length);
    }

    return 0;
}
