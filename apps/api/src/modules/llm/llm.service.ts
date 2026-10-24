import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export interface LlmJsonResult {
  /** Parsed JSON object; callers must validate its shape before use. */
  data: Record<string, unknown>;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/**
 * Thin OpenAI-compatible chat client with the platform's provider order
 * (Groq → Gemini → OpenAI). Returns null instead of throwing so every AI feature
 * can fall back to its deterministic path.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: ProviderConfig | null;

  constructor(configService: ConfigService) {
    const groqKey = configService.get<string>('GROQ_API_KEY');
    const geminiKey = configService.get<string>('GEMINI_API_KEY');
    const openaiKey = configService.get<string>('OPENAI_API_KEY');

    if (groqKey) {
      this.provider = {
        apiKey: groqKey,
        baseUrl: 'https://api.groq.com/openai/v1',
        model: configService.get<string>('GROQ_MODEL', 'openai/gpt-oss-120b'),
      };
    } else if (geminiKey) {
      this.provider = {
        apiKey: geminiKey,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash'),
      };
    } else if (openaiKey) {
      this.provider = { apiKey: openaiKey, baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
    } else {
      this.provider = null;
    }
  }

  isEnabled(): boolean {
    return this.provider !== null;
  }

  async completeJson(systemPrompt: string, userPrompt: string, temperature = 0.2): Promise<LlmJsonResult | null> {
    if (!this.provider) return null;
    const { apiKey, baseUrl, model } = this.provider;

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          response_format: { type: 'json_object' },
        }),
      });

      const json = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
      if (!res.ok) {
        this.logger.warn(`LLM request failed (${res.status}): ${json.error?.message ?? res.statusText}`);
        return null;
      }

      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed: unknown = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

      return {
        data: parsed as Record<string, unknown>,
        model,
        promptTokens: json.usage?.prompt_tokens ?? null,
        completionTokens: json.usage?.completion_tokens ?? null,
      };
    } catch (err) {
      this.logger.warn(`LLM request error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
