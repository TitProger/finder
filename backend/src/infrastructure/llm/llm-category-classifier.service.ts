import { Injectable, Logger } from '@nestjs/common';

import {
    CategoryClassificationRequest,
    CategoryClassificationResult,
    CategoryClassifierPort,
} from '../../application/ports/category-classifier.port';
import { Envs } from '../../common/envs/env';

interface LlmMessage {
    role: 'system' | 'user';
    content: string;
}

interface LlmRequest {
    model: string;
    messages: LlmMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
}

interface LlmResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

@Injectable()
export class LlmCategoryClassifierService extends CategoryClassifierPort {
    private readonly logger = new Logger(LlmCategoryClassifierService.name);

    async classify(request: CategoryClassificationRequest): Promise<CategoryClassificationResult> {
        if (!Envs.llm.apiKey) {
            this.logger.warn('LLM API key not configured, cannot classify');
            return { categoryCode: null, confidence: 0, top3: [] };
        }

        try {
            const prompt = this.buildPrompt(request);
            const response = await this.callLlm(prompt);

            return this.parseResponse(response, request.categories);
        } catch (error) {
            this.logger.error('LLM classification failed', error);
            return { categoryCode: null, confidence: 0, top3: [] };
        }
    }

    private buildPrompt(request: CategoryClassificationRequest): string {
        const categoriesJson = request.categories.map((cat) => ({
            code: cat.code,
            name: cat.name,
            description: cat.description,
            examples: cat.examplePhrases.slice(0, 5),
        }));

        return `Classify the following product inquiry into one of the given categories. Return JSON with category_code (string or null), confidence (0-1), and top3 (array of {category_code, confidence}).

Text: "${request.text}"

Categories:
${JSON.stringify(categoriesJson, null, 2)}

Return ONLY valid JSON, no markdown or extra text:
{
  "category_code": "code or null",
  "confidence": 0.95,
  "top3": [
    {"category_code": "clothing", "confidence": 0.95},
    {"category_code": "general", "confidence": 0.3}
  ]
}`;
    }

    private async callLlm(prompt: string): Promise<string> {
        const requestBody: LlmRequest = {
            model: Envs.llm.model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a classification assistant. Respond ONLY with valid JSON, no markdown formatting.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.1,
            max_tokens: 500,
        };

        const response = await fetch(Envs.llm.apiBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Envs.llm.apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`LLM API returned ${response.status}: ${await response.text()}`);
        }

        const data = (await response.json()) as LlmResponse;

        if (!data.choices || data.choices.length === 0) {
            throw new Error('LLM API returned no choices');
        }

        return data.choices[0].message.content;
    }

    private parseResponse(
        responseText: string,
        categories: CategoryClassificationRequest['categories'],
    ): CategoryClassificationResult {
        try {
            const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const parsed = JSON.parse(cleaned) as {
                category_code?: string | null;
                confidence?: number;
                top3?: Array<{ category_code?: string; confidence?: number }>;
            };

            const validCodes = new Set(categories.map((cat) => cat.code));
            const categoryCode =
                parsed.category_code && validCodes.has(parsed.category_code) ? parsed.category_code : null;
            const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

            const top3 = (parsed.top3 || [])
                .filter((item) => item.category_code && validCodes.has(item.category_code))
                .map((item) => ({
                    categoryCode: item.category_code!,
                    confidence: item.confidence || 0,
                }))
                .slice(0, 3);

            return { categoryCode, confidence, top3 };
        } catch (error) {
            this.logger.error('Failed to parse LLM response', error);
            return { categoryCode: null, confidence: 0, top3: [] };
        }
    }
}
