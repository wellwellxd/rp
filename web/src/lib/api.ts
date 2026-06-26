import { supabase, isConfigured } from './supabase';

export const isLiveBackend = isConfigured;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendMessageInput {
  characterId: string;
  sessionId: string;
  message: string;
  history: ChatTurn[];
}

export interface SendMessageResult {
  reply: string;
}

// 呼叫 Edge Function 並把「真正的錯誤訊息」攤開。
// supabase-js 在非 2xx 時丟 FunctionsHttpError，原始 body（我們的 {error}）藏在 error.context（Response）裡，
// 直接 throw 只會得到籠統的「non-2xx status code」。這裡把 body 讀出來，讓使用者看到真正原因。
async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase 未設定');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // deno-lint-ignore no-explicit-any
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json();
        if (j?.error) throw new Error(j.error);
      } catch (e) {
        if (e instanceof Error && e.message && !/json/i.test(e.message)) throw e;
      }
    }
    throw error;
  }
  // deno-lint-ignore no-explicit-any
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

// 需要密鑰 / 特權的操作一律透過 Edge Functions（functions.invoke 會自動帶上登入 JWT）。
// roleplay function 會：載入角色 canon → 呼叫 OpenRouter → 把本輪 user / assistant 訊息寫入 DB。
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  return invokeFn<SendMessageResult>('roleplay', {
    characterId: input.characterId,
    sessionId: input.sessionId,
    message: input.message,
    history: input.history,
  });
}

export interface DiaryResult {
  id: string;
  entry_date: string;
  title: string | null;
  content: string;
  emotional_state: string | null;
  location: string | null;
}

// 結束對話 → session-summary function 把這段 session 整理成一篇日記並鎖成唯讀。
export async function endSession(sessionId: string): Promise<DiaryResult> {
  const data = await invokeFn<{ entry: DiaryResult }>('session-summary', { sessionId });
  return data.entry;
}

export interface CharacterInput {
  character: {
    name?: string;
    occupation?: string;
    persona_core?: string;
    voice_style?: string;
    core_values?: string;
    backstory?: string;
    initial_date?: string;
    model?: string;
  };
  world: {
    name?: string;
    world_canon?: string;
    season?: string;
    weather_pattern?: string;
    location_state?: string;
  };
  firstLife?: string;
}

// 建立 / 編輯角色（含其世界）——共享 canon 寫入走 character-admin function（service-role）。
export async function saveCharacter(
  input: CharacterInput & { action: 'create' | 'update'; characterId?: string },
): Promise<string> {
  const data = await invokeFn<{ characterId: string }>(
    'character-admin',
    input as unknown as Record<string, unknown>,
  );
  return data.characterId;
}
