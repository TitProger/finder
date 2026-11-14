import { EntityManager } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { parse } from 'yaml';

import { QuestionAnswerType } from '../../../domain/enums/question-answer-type.enum';
import { SiteRole } from '../../../domain/enums/site-role.enum';
import { CategoryEntity } from '../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../domain/entities/category/category-site.entity';
import { QuestionPackEntity } from '../../../domain/entities/category/question-pack.entity';

interface QuestionYaml {
    code: string;
    prompt: string;
    answer_type: string;
    is_required: boolean;
    sort_order: number;
    choices?: string[];
}

interface QuestionPackYaml {
    code: string;
    title: string;
    description: string;
    trigger_keywords: string[];
    questions: QuestionYaml[];
}

interface SiteYaml {
    role: string;
    name: string;
    priority: number;
    requires_login: boolean;
    query_template: string;
    exclude_note: string | null;
}

interface CategoryYaml {
    code: string;
    name: string;
    description: string;
    phrases: string[];
    base_questions: QuestionYaml[];
    question_packs?: QuestionPackYaml[];
    sites: SiteYaml[];
}

interface SeedData {
    categories: CategoryYaml[];
}

@Injectable()
export class CategorySeederService {
    private readonly logger = new Logger(CategorySeederService.name);

    constructor(private readonly em: EntityManager) {}

    async seedFromYaml(yamlPath: string): Promise<void> {
        this.logger.log(`Loading categories from ${yamlPath}...`);
        const yamlContent = await readFile(yamlPath, 'utf-8');
        const data = parse(yamlContent) as SeedData;

        this.logger.log(`Found ${data.categories.length} categories to seed`);

        for (const categoryData of data.categories) {
            await this.upsertCategory(categoryData);
        }

        this.logger.log('Category seeding complete');
    }

    async seedFromString(yamlContent: string): Promise<void> {
        const data = parse(yamlContent) as SeedData;

        for (const categoryData of data.categories) {
            await this.upsertCategory(categoryData);
        }
    }

    private async upsertCategory(data: CategoryYaml): Promise<void> {
        this.logger.log(`Upserting category: ${data.code} (${data.name})`);

        let category = await this.em.findOne(CategoryEntity, { code: data.code });

        if (!category) {
            category = new CategoryEntity();
            category.code = data.code;
            this.logger.log(`  Creating new category: ${data.code}`);
        } else {
            this.logger.log(`  Updating existing category: ${data.code}`);
        }

        category.name = data.name;
        category.description = data.description;

        await this.em.persistAndFlush(category);

        await this.upsertPhrases(category, data.phrases);
        await this.upsertBaseQuestions(category, data.base_questions);

        if (data.question_packs) {
            for (const packData of data.question_packs) {
                await this.upsertQuestionPack(category, packData);
            }
        }

        await this.upsertSites(category, data.sites);

        this.logger.log(`  ✓ Category ${data.code} complete`);
    }

    private async upsertPhrases(category: CategoryEntity, phrases: string[]): Promise<void> {
        const existingPhrases = await this.em.find(CategoryPhraseEntity, {
            category: category.id,
        });

        const existingPhraseTexts = new Set(existingPhrases.map((p) => p.phrase));
        const newPhrases = phrases.filter((p) => !existingPhraseTexts.has(p));

        for (const phraseText of newPhrases) {
            const phrase = new CategoryPhraseEntity();
            phrase.category = category;
            phrase.phrase = phraseText;
            this.em.persist(phrase);
        }

        if (newPhrases.length > 0) {
            await this.em.flush();
            this.logger.log(`    Added ${newPhrases.length} new phrases`);
        }
    }

    private async upsertBaseQuestions(category: CategoryEntity, questions: QuestionYaml[]): Promise<void> {
        for (const qData of questions) {
            let question = await this.em.findOne(CategoryQuestionEntity, {
                category: category.id,
                code: qData.code,
                questionPack: null,
            });

            if (!question) {
                question = new CategoryQuestionEntity();
                question.category = category;
                question.code = qData.code;
                question.questionPack = null;
            }

            question.prompt = qData.prompt;
            question.answerType = QuestionAnswerType[qData.answer_type as keyof typeof QuestionAnswerType];
            question.isRequired = qData.is_required;
            question.sortOrder = qData.sort_order;
            question.choices = qData.choices || null;

            this.em.persist(question);
        }

        await this.em.flush();
        this.logger.log(`    Upserted ${questions.length} base questions`);
    }

    private async upsertQuestionPack(category: CategoryEntity, packData: QuestionPackYaml): Promise<void> {
        let pack = await this.em.findOne(QuestionPackEntity, {
            category: category.id,
            code: packData.code,
        });

        if (!pack) {
            pack = new QuestionPackEntity();
            pack.category = category;
            pack.code = packData.code;
        }

        pack.title = packData.title;
        pack.description = packData.description || null;

        await this.em.persistAndFlush(pack);

        for (const qData of packData.questions) {
            let question = await this.em.findOne(CategoryQuestionEntity, {
                category: category.id,
                questionPack: pack.id,
                code: qData.code,
            });

            if (!question) {
                question = new CategoryQuestionEntity();
                question.category = category;
                question.questionPack = pack;
                question.code = qData.code;
            }

            question.prompt = qData.prompt;
            question.answerType = QuestionAnswerType[qData.answer_type as keyof typeof QuestionAnswerType];
            question.isRequired = qData.is_required;
            question.sortOrder = qData.sort_order;
            question.choices = qData.choices || null;

            this.em.persist(question);
        }

        await this.em.flush();
        this.logger.log(`    Upserted pack: ${packData.code} with ${packData.questions.length} questions`);
    }

    private async upsertSites(category: CategoryEntity, sites: SiteYaml[]): Promise<void> {
        const existingSites = await this.em.find(CategorySiteEntity, {
            category: category.id,
        });

        for (const existing of existingSites) {
            this.em.remove(existing);
        }

        for (const siteData of sites) {
            const site = new CategorySiteEntity();
            site.category = category;
            site.name = siteData.name;
            site.siteRole = SiteRole[siteData.role as keyof typeof SiteRole];
            site.priority = siteData.priority;
            site.requiresLogin = siteData.requires_login;
            site.queryTemplate = siteData.query_template;
            site.excludeNote = siteData.exclude_note;

            this.em.persist(site);
        }

        await this.em.flush();
        this.logger.log(`    Upserted ${sites.length} sites`);
    }
}
