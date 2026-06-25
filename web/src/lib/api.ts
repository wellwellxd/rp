import { supabase } from './supabase';

// 需要密鑰 / 特權的操作一律透過 Edge Functions，不在前端直接呼叫 OpenRouter。
// functions.invoke 會自動帶上登入使用者的 JWT。

export async function sendMessage(input: {
  sessionId?: string;
  characterId: string;
  message: string;
}) {
  const { data, error } = await supabase.functions.invoke('roleplay', { body: input });
  if (error) throw error;
  return data;
}

export async function endSession(sessionId: string) {
  const { data, error } = await supabase.functions.invoke('session-summary', {
    body: { sessionId },
  });
  if (error) throw error;
  return data;
}
