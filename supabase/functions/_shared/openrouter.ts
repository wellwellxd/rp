/**
 * 統一 LLM 入口 —— 所有模型呼叫走 OpenRouter（OpenAI 相容 REST）。
 * 只在 Edge Function 內執行，API key 從 secret 讀取，絕不進前端。
 */
const BASE_URL = Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';

function apiKey(): string {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY secret is not set');
  return key;
}

export interface ChatOptions {
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  temperature?: number;
}

/** 產生一段文字回覆（roleplay / diary / summary 共用）。 */
export async function chat(_opts: ChatOptions): Promise<string> {
  // TODO(phase-2)：POST `${BASE_URL}/chat/completions`，帶 Authorization: Bearer apiKey()。
  void apiKey;
  throw new Error('not implemented');
}

/** 產生 embedding（記憶檢索用），維度需對齊 DB schema 的 vector(1536)。 */
export async function embed(_text: string): Promise<number[]> {
  // TODO(phase-5)：POST `${BASE_URL}/embeddings`。
  void BASE_URL;
  throw new Error('not implemented');
}
