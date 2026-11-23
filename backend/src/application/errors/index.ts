import { AuthErrors } from './auth.errors';
import { CategoryErrors } from './category.errors';
import { CommonErrors } from './common.errors';
import { DossierErrors } from './dossier.errors';
import { EconomicsErrors } from './economics.errors';
import { FileErrors } from './file.errors';
import { InquiryErrors } from './inquiry.errors';
import { OptimalCardErrors } from './optimal-card.errors';
import { RatesErrors } from './rates.errors';
import { ResearchErrors } from './research.errors';
import { TaxonomyErrors } from './taxonomy.errors';

/**
 * Каталог application-ошибок.
 * В сервисах: `AppErrors.common.notFound` → `{ code, message }`.
 */
export const AppErrors = {
    common: CommonErrors,
    category: CategoryErrors,
    taxonomy: TaxonomyErrors,
    auth: AuthErrors,
    inquiry: InquiryErrors,
    economics: EconomicsErrors,
    optimalCard: OptimalCardErrors,
    dossier: DossierErrors,
    research: ResearchErrors,
    rates: RatesErrors,
    file: FileErrors,
} as const;

export type { AppError } from './types';
export { appError } from './types';
