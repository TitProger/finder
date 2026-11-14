import { AuthErrors } from './auth.errors';
import { CategoryErrors } from './category.errors';
import { CommonErrors } from './common.errors';
import { InquiryErrors } from './inquiry.errors';
import { OptimalCardErrors } from './optimal-card.errors';
import { ResearchErrors } from './research.errors';

/**
 * Каталог application-ошибок.
 * В сервисах: `AppErrors.common.notFound` → `{ code, message }`.
 */
export const AppErrors = {
    common: CommonErrors,
    category: CategoryErrors,
    auth: AuthErrors,
    inquiry: InquiryErrors,
    optimalCard: OptimalCardErrors,
    research: ResearchErrors,
} as const;

export type { AppError } from './types';
export { appError } from './types';
