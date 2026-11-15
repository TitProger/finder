import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import {
    CATEGORY_ADMIN_SERVICE,
    CategoryAdminService,
} from '../../application/services/contracts/category/category-admin.service';
import {
    ClientDialog,
    INQUIRY_SERVICE,
    InquiryService,
    InquiryView,
} from '../../application/services/contracts/inquiry/inquiry.service';
import {
    PLAN_MANAGER_SERVICE,
    PlanManagerService,
} from '../../application/services/contracts/tariff/plan-manager.service';
import { AppException } from '../../common/exceptions/common/app.exception';
import { ConflictAppException } from '../../common/exceptions/conflict.exception';
import { CategoryStatus } from '../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../domain/enums/inquiry-status.enum';
import { QuestionAnswerType } from '../../domain/enums/question-answer-type.enum';
import { SiteRole } from '../../domain/enums/site-role.enum';
import { isCategoryRejection } from '../../domain/text/category-rejection';
import { normalizePhrase } from '../../domain/text/phrase-text';
import { formatAskedPrompt } from '../../application/services/impls/inquiry/parse-inquiry-answer';
import {
    MANAGER_HANDOFF,
    ManagerHandoffService,
} from '../../application/services/impls/manager/manager-handoff.service';
import {
    INQUIRY_ECONOMICS,
    InquiryEconomicsService,
    InquiryEconomicsView,
} from '../../application/services/impls/market/inquiry-economics.service';
import {
    RESEARCH_LAUNCH_SERVICE,
    ResearchLaunchService,
} from '../../application/services/impls/research/research-launch.service';
import { parseEconomicsLine } from '../../domain/market/parse-economics-line';
import { parseCallback } from './telegram-callback';
import { TELEGRAM_OUTBOUND, TelegramButton, TelegramIncoming, TelegramOutbound } from './telegram.types';

const NEAREST = 3;
const PAGE_SIZE = 5;
const PAUSE_TEXT = 'Менеджер уточняет направление.';
const DONE_TEXT = 'Ответы записаны. Дальше считает менеджер.';
const RESEARCH_ACCEPTED_TEXT = 'Заявка принята, менеджер скоро ответит';
const CARD_SERVED_TEXT = 'Менеджер скоро ответит';
const LIMIT_TEXT = 'Исчерпан дневной лимит запросов. Попробуйте завтра или обратитесь к менеджеру.';

const SITE_ROLES: { key: string; role: SiteRole; label: string }[] = [
    { key: 'f', role: SiteRole.FACTORY_CONTACT, label: 'Контакт завода' },
    { key: 'c', role: SiteRole.CHINA_OPEN_PRICE, label: 'Открытая цена Китая' },
    { key: 'r', role: SiteRole.RUSSIA_RETAIL, label: 'Розница России' },
    { key: 'w', role: SiteRole.RUSSIA_WHOLESALE, label: 'Опт России' },
];

type CategoryDraft = {
    inquiryId: string;
    step: 'name' | 'description' | 'question' | 'site_role' | 'site_name';
    name: string;
    description: string;
    question: string;
    siteRole: SiteRole | null;
};

type MessageUpdate = Extract<TelegramIncoming, { kind: 'message' }>;
type CallbackUpdate = Extract<TelegramIncoming, { kind: 'callback' }>;

/**
 * Диалог клиента и кнопки админа.
 * Заявку пишет через application. Клиенту не отправляет цену.
 */
@Injectable()
export class TelegramDialog {
    private readonly logger = new Logger(TelegramDialog.name);
    private readonly drafts = new Map<number, CategoryDraft>();
    private readonly economicsDrafts = new Map<number, string>();

    constructor(
        @Inject(INQUIRY_SERVICE)
        private readonly inquiries: InquiryService,
        @Inject(CATEGORY_ADMIN_SERVICE)
        private readonly categories: CategoryAdminService,
        @Inject(PLAN_MANAGER_SERVICE)
        private readonly planManager: PlanManagerService,
        @Inject(TELEGRAM_OUTBOUND)
        private readonly outbound: TelegramOutbound,
        @Optional()
        @Inject(MANAGER_HANDOFF)
        private readonly handoff?: ManagerHandoffService,
        @Optional()
        @Inject(RESEARCH_LAUNCH_SERVICE)
        private readonly launch?: ResearchLaunchService,
        @Optional()
        @Inject(INQUIRY_ECONOMICS)
        private readonly economics?: InquiryEconomicsService,
    ) {}

    async handle(update: TelegramIncoming): Promise<void> {
        try {
            if (update.kind === 'callback') {
                await this.onCallback(update);

                return;
            }

            await this.onMessage(update);
        } catch (error) {
            if (error instanceof AppException) {
                await this.send(update.chatId, error.message);

                return;
            }

            throw error;
        } finally {
            if (update.kind === 'callback') {
                await this.outbound.deliver({
                    method: 'answerCallbackQuery',
                    callbackQueryId: update.callbackQueryId,
                });
            }
        }
    }

    private async onMessage(update: MessageUpdate): Promise<void> {
        const actor = await this.inquiries.resolveTelegramActor(update.telegramUserId);

        if (actor.kind === 'admin') {
            await this.onAdminMessage(update);

            return;
        }

        await this.onClientMessage(update);
    }

    private async onClientMessage(update: MessageUpdate): Promise<void> {
        const dialog = await this.inquiries.findClientDialog(update.telegramUserId);

        if (dialog.kind === 'paused') {
            await this.send(update.chatId, PAUSE_TEXT);

            return;
        }

        if (dialog.kind === 'asking') {
            await this.answerOrReject(update, dialog);

            return;
        }

        await this.startInquiry(update);
    }

    private async answerOrReject(
        update: MessageUpdate,
        dialog: Extract<ClientDialog, { kind: 'asking' }>,
    ): Promise<void> {
        if (update.text && isCategoryRejection(update.text)) {
            const view = await this.inquiries.rejectCategory({
                inquiryId: dialog.view.inquiry.id,
                telegramUserId: update.telegramUserId,
            });

            await this.send(update.chatId, PAUSE_TEXT);
            await this.notifyAdmins(view);

            return;
        }

        if (!update.text) {
            await this.send(update.chatId, 'Ответьте текстом на вопрос.');

            return;
        }

        const next = await this.inquiries.answerQuestion({
            inquiryId: dialog.view.inquiry.id,
            telegramUserId: update.telegramUserId,
            text: update.text,
        });

        if (next.kind === 'asking') {
            await this.send(update.chatId, questionText(null, next.prompt, next.index, next.total));

            return;
        }

        if (next.kind === 'complete') {
            const refused = limitRefusalText(next.view);

            if (refused) {
                await this.send(update.chatId, refused);

                return;
            }

            const handoff = clientStatusText(next.view);

            if (handoff) {
                await this.send(update.chatId, handoff);

                return;
            }
        }

        await this.send(update.chatId, DONE_TEXT);
    }

    private async startInquiry(update: MessageUpdate): Promise<void> {
        if (!update.text) {
            await this.send(update.chatId, 'Напишите, что нужно найти. Фото можно приложить к этому тексту.');

            return;
        }

        const view = await this.inquiries.create({
            telegramUserId: update.telegramUserId,
            text: update.text,
            photoFileIds: update.photoFileIds,
        });

        const refused = limitRefusalText(view);

        if (refused) {
            await this.send(update.chatId, refused);

            return;
        }

        const handoff = clientStatusText(view);

        if (handoff) {
            await this.send(update.chatId, handoff);

            return;
        }

        if (view.inquiry.isPaused || !view.inquiry.category) {
            await this.send(update.chatId, PAUSE_TEXT);
            await this.notifyAdmins(view);

            return;
        }

        await this.tellClient(view);
    }

    private async onAdminMessage(update: MessageUpdate): Promise<void> {
        // Команда /plan <telegram_id> [plan_code]
        if (update.text?.startsWith('/plan ')) {
            await this.handlePlanCommand(update.chatId, update.text);

            return;
        }

        if (this.economicsDrafts.has(update.telegramUserId)) {
            await this.applyEconomicsDraft(update);

            return;
        }

        const draft = this.drafts.get(update.telegramUserId);

        if (!draft) {
            await this.send(
                update.chatId,
                'Сюда приходят заявки, по которым нужно выбрать категорию.\n\n' +
                    'Команды:\n' +
                    '/plan <telegram_id> <plan_code> - изменить тариф\n' +
                    '/plan <telegram_id> - показать тариф и использование',
            );

            return;
        }

        const text = update.text?.trim() ?? '';

        if (normalizePhrase(text) === 'отмена') {
            this.drafts.delete(update.telegramUserId);
            await this.send(update.chatId, 'Создание категории отменено.');

            return;
        }

        if (!text) {
            await this.send(update.chatId, 'Нужен текст.');

            return;
        }

        if (draft.step === 'name') {
            draft.name = text;
            draft.step = 'description';
            await this.send(update.chatId, 'Описание категории. Цену в описание не кладите.');

            return;
        }

        if (draft.step === 'description') {
            draft.description = text;
            draft.step = 'question';
            await this.send(update.chatId, 'Текст вопроса клиенту.');

            return;
        }

        if (draft.step === 'question') {
            draft.question = text;
            draft.step = 'site_role';
            await this.send(update.chatId, 'Роль площадки.', siteRoleButtons());

            return;
        }

        if (draft.step === 'site_role') {
            await this.send(update.chatId, 'Выберите роль площадки кнопкой.', siteRoleButtons());

            return;
        }

        await this.finishDraft(update, draft, text);
    }

    private async applyEconomicsDraft(update: MessageUpdate): Promise<void> {
        const inquiryId = this.economicsDrafts.get(update.telegramUserId);

        if (!inquiryId) {
            return;
        }

        const text = update.text?.trim() ?? '';

        if (normalizePhrase(text) === 'отмена') {
            this.economicsDrafts.delete(update.telegramUserId);
            await this.send(update.chatId, 'Расчёт отменён.');

            return;
        }

        const parsed = parseEconomicsLine(text);

        if (!parsed.ok) {
            await this.send(update.chatId, parsed.message);

            return;
        }

        if (!this.economics) {
            await this.send(update.chatId, 'Расчёт сейчас недоступен.');

            return;
        }

        try {
            const view = await this.economics.save(inquiryId, parsed.value);

            this.economicsDrafts.delete(update.telegramUserId);
            await this.send(update.chatId, formatLanded(view));
        } catch (error) {
            if (error instanceof AppException) {
                await this.send(update.chatId, error.message);

                return;
            }

            throw error;
        }
    }

    private async onCallback(update: CallbackUpdate): Promise<void> {
        const actor = await this.inquiries.resolveTelegramActor(update.telegramUserId);

        if (actor.kind !== 'admin') {
            await this.send(update.chatId, 'Это действие для админа.');

            return;
        }

        const parsed = parseCallback(update.data);

        if (!parsed) {
            await this.send(update.chatId, 'Кнопка устарела.');

            return;
        }

        if (parsed.type === 'site_role') {
            await this.pickSiteRole(update, parsed.role);

            return;
        }

        if (parsed.type === 'assign') {
            await this.assignCandidate(update, actor.userId, parsed.inquiryId, parsed.index);

            return;
        }

        if (parsed.type === 'list') {
            await this.showCategoryPage(update.chatId, parsed.inquiryId, parsed.page);

            return;
        }

        if (parsed.type === 'pick') {
            await this.pickListedCategory(update, actor.userId, parsed.inquiryId, parsed.page, parsed.index);

            return;
        }

        if (parsed.type === 'make_optimal') {
            await this.makeOptimal(update, actor.userId, parsed.inquiryId);

            return;
        }

        if (parsed.type === 'close') {
            await this.closeInquiry(update, actor.userId, parsed.inquiryId);

            return;
        }

        if (parsed.type === 'rerun') {
            await this.rerunResearch(update, parsed.inquiryId);

            return;
        }

        if (parsed.type === 'economics') {
            this.economicsDrafts.set(update.telegramUserId, parsed.inquiryId);
            await this.send(
                update.chatId,
                'Одной строкой: доставка=30 пошлина=10 наценка=25. Можно добавить прочее=5. «отмена» прервёт.',
            );

            return;
        }

        if (parsed.type !== 'new') {
            await this.send(update.chatId, 'Кнопка устарела.');

            return;
        }

        this.drafts.set(update.telegramUserId, emptyDraft(parsed.inquiryId));
        await this.send(update.chatId, 'Название новой категории. Слово «отмена» прервёт.');
    }

    private async assignCandidate(
        update: CallbackUpdate,
        adminUserId: string,
        inquiryId: string,
        index: number,
    ): Promise<void> {
        const view = await this.inquiries.getById(inquiryId);
        const candidate = (view.inquiry.classificationScores?.candidates ?? []).slice(0, NEAREST)[index];

        if (!candidate) {
            await this.send(update.chatId, 'Этой категории в списке нет.');

            return;
        }

        await this.assignAndTell(inquiryId, candidate.categoryId, adminUserId, update.chatId, update.telegramUserId);
    }

    private async pickListedCategory(
        update: CallbackUpdate,
        adminUserId: string,
        inquiryId: string,
        page: number,
        index: number,
    ): Promise<void> {
        const categories = await this.categories.listActive();
        const category = categories.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)[index];

        if (!category) {
            await this.send(update.chatId, 'Этой категории в списке нет.');

            return;
        }

        await this.assignAndTell(inquiryId, category.id, adminUserId, update.chatId, update.telegramUserId);
    }

    private async showCategoryPage(chatId: number, inquiryId: string, page: number): Promise<void> {
        const categories = await this.categories.listActive();
        const start = page * PAGE_SIZE;
        const slice = categories.slice(start, start + PAGE_SIZE);

        if (slice.length === 0) {
            await this.send(chatId, 'Активных категорий нет.', [
                [{ text: 'Новая категория', callbackData: `n:${inquiryId}` }],
            ]);

            return;
        }

        const rows: TelegramButton[][] = slice.map((category, index) => [
            { text: clip(category.name), callbackData: `p:${inquiryId}:${page}:${index}` },
        ]);

        if (page > 0) {
            rows.push([{ text: 'Назад', callbackData: `l:${inquiryId}:${page - 1}` }]);
        }

        if (start + PAGE_SIZE < categories.length) {
            rows.push([{ text: 'Дальше', callbackData: `l:${inquiryId}:${page + 1}` }]);
        }

        rows.push([{ text: 'Новая категория', callbackData: `n:${inquiryId}` }]);
        await this.send(chatId, 'Выберите категорию.', rows);
    }

    private async pickSiteRole(update: CallbackUpdate, role: SiteRole): Promise<void> {
        const draft = this.drafts.get(update.telegramUserId);

        if (!draft || draft.step !== 'site_role') {
            await this.send(update.chatId, 'Сначала начните создание категории.');

            return;
        }

        draft.siteRole = role;
        draft.step = 'site_name';
        await this.send(update.chatId, 'Название площадки.');
    }

    private async finishDraft(update: MessageUpdate, draft: CategoryDraft, siteName: string): Promise<void> {
        const actor = await this.inquiries.resolveTelegramActor(update.telegramUserId);

        if (actor.kind !== 'admin') {
            return;
        }

        let categoryId: string;

        try {
            const category = await this.categories.createCategory({
                name: draft.name.trim(),
                description: draft.description.trim(),
                status: CategoryStatus.ACTIVE,
            });

            categoryId = category.id;
        } catch (error) {
            if (error instanceof ConflictAppException) {
                draft.step = 'name';
                await this.send(update.chatId, `${error.message} Напишите другое название.`);

                return;
            }

            throw error;
        }

        await this.categories.createQuestion(categoryId, {
            prompt: draft.question.trim(),
            answerType: QuestionAnswerType.TEXT,
            isRequired: true,
            sortOrder: 0,
        });
        await this.categories.createSite(categoryId, {
            siteRole: draft.siteRole ?? SiteRole.FACTORY_CONTACT,
            name: siteName.trim(),
            isActive: true,
        });
        this.drafts.delete(update.telegramUserId);
        await this.assignAndTell(draft.inquiryId, categoryId, actor.userId, update.chatId, update.telegramUserId);
    }

    private async assignAndTell(
        inquiryId: string,
        categoryId: string,
        adminUserId: string,
        adminChatId: number,
        adminTelegramUserId: number,
    ): Promise<void> {
        const view = await this.inquiries.assignCategory({ inquiryId, categoryId, adminUserId });

        this.drafts.delete(adminTelegramUserId);
        await this.send(adminChatId, `Категория назначена: ${view.inquiry.category?.name ?? ''}`);
        await this.tellClient(view);
    }

    private async makeOptimal(update: CallbackUpdate, adminUserId: string, inquiryId: string): Promise<void> {
        if (!this.handoff) {
            await this.send(update.chatId, 'Действие пока недоступно.');

            return;
        }

        await this.handoff.makeOptimal(inquiryId, adminUserId);
        await this.send(update.chatId, 'Оптимальная карточка сохранена. Её можно поправить позже.');
    }

    private async closeInquiry(update: CallbackUpdate, adminUserId: string, inquiryId: string): Promise<void> {
        if (!this.handoff) {
            await this.send(update.chatId, 'Действие пока недоступно.');

            return;
        }

        await this.handoff.close(inquiryId, adminUserId);
        await this.send(update.chatId, 'Заявка закрыта.');
    }

    private async rerunResearch(update: CallbackUpdate, inquiryId: string): Promise<void> {
        if (!this.launch) {
            await this.send(update.chatId, 'Действие пока недоступно.');

            return;
        }

        await this.launch.rerun(inquiryId);
        await this.send(update.chatId, 'Ресерч запущен заново.');
    }

    private async tellClient(view: InquiryView): Promise<void> {
        const telegramUserId = toTelegramUserId(view.inquiry.clientUser.telegramUserId);

        if (telegramUserId === null) {
            return;
        }

        const handoff = clientStatusText(view);

        if (handoff) {
            await this.send(telegramUserId, handoff);

            return;
        }

        const name = view.inquiry.category?.name ?? '';
        const dialog = await this.inquiries.findClientDialog(telegramUserId);

        if (dialog.kind === 'asking') {
            await this.send(telegramUserId, questionText(name, dialog.prompt, dialog.index, dialog.total));

            return;
        }

        // Повторное чтение может всё ещё видеть паузу. Вопросы уже есть в view назначения:
        // спрашиваем их, а не пишем «вопросов нет».
        const question = view.questions[0];

        if (question) {
            await this.send(
                telegramUserId,
                questionText(name, formatAskedPrompt(question.prompt, question.choices), 0, view.questions.length),
            );

            return;
        }

        if (name) {
            await this.send(telegramUserId, `${categoryLine(name)} Вопросов нет, дальше считает менеджер.`);
        }
    }

    private async notifyAdmins(view: InquiryView): Promise<void> {
        const recipients = await this.inquiries.listAdminRecipients();

        if (recipients.length === 0) {
            this.logger.warn('Пауза заявки без админа с Telegram user id');
        }

        const candidates = (view.inquiry.classificationScores?.candidates ?? []).slice(0, NEAREST);
        const text = adminCardText(view, candidates);
        const buttons = adminButtons(view.inquiry.id, candidates);

        for (const recipient of recipients) {
            for (const fileId of view.inquiry.photoUrls) {
                await this.outbound.deliver({
                    method: 'sendPhoto',
                    chatId: recipient.telegramUserId,
                    fileId,
                });
            }

            await this.outbound.deliver({
                method: 'sendMessage',
                chatId: recipient.telegramUserId,
                text,
                buttons,
            });
        }
    }

    private async send(chatId: number, text: string, buttons?: TelegramButton[][]): Promise<void> {
        await this.outbound.deliver({ method: 'sendMessage', chatId, text, buttons });
    }

    private async handlePlanCommand(chatId: number, text: string): Promise<void> {
        const parts = text.trim().split(/\s+/);

        if (parts.length < 2) {
            await this.send(
                chatId,
                'Использование:\n' +
                    '/plan <telegram_id> <plan_code> - изменить тариф\n' +
                    '/plan <telegram_id> - показать текущий тариф',
            );

            return;
        }

        const telegramUserId = parts[1];
        const planCode = parts[2];

        if (!planCode) {
            // Показать текущий тариф
            const info = await this.planManager.getUserPlanInfo(telegramUserId);

            if (!info) {
                await this.send(chatId, `❌ Пользователь с Telegram ID ${telegramUserId} не найден`);

                return;
            }

            const limitText =
                info.currentPlan.dailyLimit === null ? '∞ (безлимит)' : `${info.currentPlan.dailyLimit}/день`;
            const remainingText =
                info.todayUsage.remaining === null
                    ? '∞'
                    : `${info.todayUsage.remaining} (использовано ${info.todayUsage.count})`;

            await this.send(
                chatId,
                `👤 Пользователь: ${info.displayName || telegramUserId}\n` +
                    `📋 Тариф: ${info.currentPlan.title} (${info.currentPlan.code})\n` +
                    `📊 Лимит: ${limitText}\n` +
                    `📅 Осталось сегодня: ${remainingText}\n` +
                    `📆 Дата: ${info.todayUsage.date}`,
            );

            return;
        }

        // Изменить тариф
        const info = await this.planManager.getUserPlanInfo(telegramUserId);

        if (!info) {
            await this.send(chatId, `❌ Пользователь с Telegram ID ${telegramUserId} не найден`);

            return;
        }

        try {
            await this.planManager.changePlan(info.userId, planCode);
            await this.send(
                chatId,
                `✅ Тариф пользователя ${info.displayName || telegramUserId} изменён на '${planCode}'`,
            );
        } catch (error) {
            if (error instanceof AppException) {
                await this.send(chatId, `❌ Ошибка: ${error.message}`);
            } else {
                throw error;
            }
        }
    }
}

function emptyDraft(inquiryId: string): CategoryDraft {
    return {
        inquiryId,
        step: 'name',
        name: '',
        description: '',
        question: '',
        siteRole: null,
    };
}

function clientStatusText(view: InquiryView): string | null {
    if (view.inquiry.status === InquiryStatus.RESEARCHING) {
        return RESEARCH_ACCEPTED_TEXT;
    }

    if (view.inquiry.status === InquiryStatus.SERVED_FROM_DATABASE) {
        return CARD_SERVED_TEXT;
    }

    return null;
}

function limitRefusalText(view: InquiryView): string | null {
    if (view.inquiry.status !== InquiryStatus.LIMIT_EXCEEDED) {
        return null;
    }

    return view.inquiry.pauseReason || LIMIT_TEXT;
}

function categoryLine(name: string): string {
    return `Отнёс к категории «${name}».`;
}

function questionText(categoryName: string | null, prompt: string, index: number, total: number): string {
    const body = `Вопрос ${index + 1} из ${total}\n${prompt}`;

    if (index === 0 && categoryName) {
        return `${categoryLine(categoryName)}\n\n${body}`;
    }

    return body;
}

function adminCardText(view: InquiryView, candidates: { categoryName: string }[]): string {
    const lines = ['Сомнение по заявке.', '', view.inquiry.rawText];

    if (view.inquiry.pauseReason) {
        lines.push('', view.inquiry.pauseReason);
    }

    if (candidates.length > 0) {
        lines.push('', 'Ближайшие категории:');
        candidates.forEach((candidate, index) => {
            lines.push(`${index + 1}. ${candidate.categoryName}`);
        });
    }

    return lines.join('\n');
}

function adminButtons(inquiryId: string, candidates: { categoryName: string }[]): TelegramButton[][] {
    const rows = candidates.map((candidate, index) => [
        { text: clip(candidate.categoryName), callbackData: `a:${inquiryId}:${index}` },
    ]);

    rows.push([{ text: 'Другая категория', callbackData: `l:${inquiryId}:0` }]);
    rows.push([{ text: 'Новая категория', callbackData: `n:${inquiryId}` }]);

    return rows;
}

function siteRoleButtons(): TelegramButton[][] {
    return SITE_ROLES.map((item) => [{ text: item.label, callbackData: `sr:${item.key}` }]);
}

function formatLanded(view: InquiryEconomicsView): string {
    if (view.landed.length === 0) {
        return 'Экономика записана. Заводской цены в досье нет, себестоимость не посчитана.';
    }

    return view.landed
        .map((item) => {
            const retail =
                item.retailRub === null
                    ? 'Розницы РФ по этой единице нет, вердикта нет.'
                    : `Розница РФ: ${item.retailRub} RUB\nРазница: ${item.deltaRub} RUB\n${item.verdict === 'выгодно' ? 'Выгодно.' : 'Не выгодно.'}`;
            const rate =
                item.fxUsed === 'fallback'
                    ? 'Курс запасной.'
                    : item.fxUsed === 'dossier'
                      ? 'Курс из досье.'
                      : 'Цена уже в RUB.';

            return [`Единица: ${item.unit}`, `Себестоимость: ${item.landedRub} RUB`, retail, rate].join('\n');
        })
        .join('\n\n');
}

function clip(name: string): string {
    if (name.length <= 60) {
        return name;
    }

    return `${name.slice(0, 59)}…`;
}

function toTelegramUserId(value: string | null | undefined): number | null {
    if (!value || !/^[1-9]\d{0,15}$/.test(value)) {
        return null;
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed)) {
        return null;
    }

    return parsed;
}
