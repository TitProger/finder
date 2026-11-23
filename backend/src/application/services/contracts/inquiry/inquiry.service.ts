import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';

export const INQUIRY_SERVICE = Symbol('INQUIRY_SERVICE');

export type CreateInquiryInput = {
    text: string;
    photoFileIds?: string[];
};

export type AssignCategoryInput = {
    inquiryId: string;
    categoryId: string;
    adminUserId?: string;
};

export type CreateCategoryAndAssignInput = {
    inquiryId: string;
    adminUserId?: string;
    name: string;
    description: string;
};

export type InquiryView = {
    inquiry: InquiryEntity;
    questions: CategoryQuestionEntity[];
};

export interface InquiryService {
    create(input: CreateInquiryInput): Promise<InquiryView>;
    getById(id: string): Promise<InquiryView>;
    assignCategory(input: AssignCategoryInput): Promise<InquiryView>;
    createCategoryAndAssign(input: CreateCategoryAndAssignInput): Promise<InquiryView>;
}
