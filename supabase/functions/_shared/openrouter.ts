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
  maxTokens?: number;
}

/** 產生一段文字回覆（roleplay / diary / summary 共用）。 */
export async function chat(opts: ChatOptions): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 1200,
      // RP 不需要長鏈推理：對支援切換的模型（如 GLM 4.7、Qwen thinking）關掉 reasoning，
      // 否則 token 會花在思考上、在吐出正式回覆前就被 max_tokens 截斷（finish_reason=length，content 為空）。
      reasoning: { enabled: false },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`OpenRouter error: model=${opts.model} status=${res.status} body=${body.slice(0, 500)}`);
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const choice = data?.choices?.[0];
  const msg = choice?.message;
  // 正常情況 content 是字串；少數模型可能把文字放在 reasoning，或被截斷成空。
  const content = typeof msg?.content === 'string' && msg.content.trim()
    ? msg.content
    : (typeof msg?.reasoning === 'string' ? msg.reasoning : '');
  if (!content.trim()) {
    const why = choice?.finish_reason === 'length'
      ? '回覆被長度限制截斷（content 為空）。可能是模型耗在推理上——已關閉 reasoning，若仍發生請提高 max_tokens 或換模型。'
      : '模型未回傳文字內容。';
    throw new Error(`OpenRouter empty content (${choice?.finish_reason ?? '?'}): ${why}`);
  }
  return content;
}

/** 產生 embedding（記憶檢索用），維度需對齊 DB schema 的 vector(1536)。 */
export async function embed(_text: string): Promise<number[]> {
  // TODO(phase-5)：POST `${BASE_URL}/embeddings`。
  throw new Error('not implemented');
}
