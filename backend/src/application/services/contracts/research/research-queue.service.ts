import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchTaskEntity } from '../../../../domain/entities/market/research-task.entity';

export const RESEARCH_QUEUE_SERVICE = Symbol('RESEARCH_QUEUE_SERVICE');

export interface ResearchQueueService {
    /** Ставит заявку в очередь Postgres. Повтор с открытой задачей не дублирует. */
    enqueue(inquiry: InquiryEntity): Promise<ResearchTaskEntity>;
    /** Забирает PENDING и зовёт асинхронный мост. */
    processNext(now?: Date): Promise<ResearchTaskEntity | null>;
}
