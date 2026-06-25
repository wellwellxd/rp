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
