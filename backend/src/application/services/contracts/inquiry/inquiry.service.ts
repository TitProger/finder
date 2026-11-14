import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';

export const INQUIRY_SERVICE = Symbol('INQUIRY_SERVICE');

export type CreateInquiryInput = {
    telegramUserId: number;
    text: string;
    photoFileIds?: string[];
};

export type AssignCategoryInput = {
    inquiryId: string;
    categoryId: string;
    adminUserId: string;
};

export type CreateCategoryAndAssignInput = {
    inquiryId: string;
    adminUserId: string;
    name: string;
    description: string;
};

export type InquiryView = {
    inquiry: InquiryEntity;
    questions: CategoryQuestionEntity[];
};

export type TelegramActor =
    | { kind: 'admin'; userId: string; telegramUserId: number }
    | { kind: 'client'; userId: string; telegramUserId: number }
    | { kind: 'new_client'; telegramUserId: number };

export type AdminRecipient = {
    userId: string;
    telegramUserId: number;
};

export type ClientDialog =
    | { kind: 'idle' }
    | { kind: 'paused'; view: InquiryView }
    | { kind: 'asking'; view: InquiryView; prompt: string; index: number; total: number }
    | { kind: 'complete'; view: InquiryView };

export type AnswerQuestionInput = {
    inquiryId: string;
    telegramUserId: number;
    text: string;
};

export type RejectCategoryInput = {
    inquiryId: string;
    telegramUserId: number;
};

export interface InquiryService {
    create(input: CreateInquiryInput): Promise<InquiryView>;
    getById(id: string): Promise<InquiryView>;
    assignCategory(input: AssignCategoryInput): Promise<InquiryView>;
    createCategoryAndAssign(input: CreateCategoryAndAssignInput): Promise<InquiryView>;
    resolveTelegramActor(telegramUserId: number): Promise<TelegramActor>;
    listAdminRecipients(): Promise<AdminRecipient[]>;
    findClientDialog(telegramUserId: number): Promise<ClientDialog>;
    answerQuestion(input: AnswerQuestionInput): Promise<ClientDialog>;
    rejectCategory(input: RejectCategoryInput): Promise<InquiryView>;
}
