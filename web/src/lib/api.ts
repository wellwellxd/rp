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

// 需要密鑰 / 特權的操作一律透過 Edge Functions（functions.invoke 會自動帶上登入 JWT）。
// roleplay function 會：載入角色 canon → 呼叫 OpenRouter → 把本輪 user / assistant 訊息寫入 DB。
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  if (!supabase) throw new Error('Supabase 未設定');
  const { data, error } = await supabase.functions.invoke('roleplay', {
    body: {
      characterId: input.characterId,
      sessionId: input.sessionId,
      message: input.message,
      history: input.history,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as SendMessageResult;
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
  if (!supabase) throw new Error('Supabase 未設定');
  const { data, error } = await supabase.functions.invoke('session-summary', {
    body: { sessionId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.entry as DiaryResult;
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
  if (!supabase) throw new Error('Supabase 未設定');
  const { data, error } = await supabase.functions.invoke('character-admin', { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.characterId as string;
}
