import { supabase, isConfigured } from './supabase';
import { mockReply, type ChatTurn } from './mockBackend';

// 是否已設定真正的後端。未設定時走本機 mock，讓 UI 能即時開發與檢視。
export const isLiveBackend = isConfigured;

export interface SendMessageInput {
  sessionId?: string;
  characterId: string;
  message: string;
  history: ChatTurn[];
}

export interface SendMessageResult {
  reply: string;
  sessionId?: string;
}

// 需要密鑰 / 特權的操作一律透過 Edge Functions，不在前端直接呼叫 OpenRouter。
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  if (!isLiveBackend) {
    // demo 模式：模擬一點延遲，回傳 mock 回覆
    await new Promise((r) => setTimeout(r, 450));
    return { reply: mockReply(input.history, input.message) };
  }

  const { data, error } = await supabase!.functions.invoke('roleplay', {
    body: {
      sessionId: input.sessionId,
      characterId: input.characterId,
      message: input.message,
      history: input.history,
    },
  });
  if (error) throw error;
  return data as SendMessageResult;
}

export async function endSession(sessionId: string) {
  if (!isLiveBackend) return { ok: true };
  const { data, error } = await supabase!.functions.invoke('session-summary', {
    body: { sessionId },
  });
  if (error) throw error;
  return data;
}
