// POST /functions/v1/roleplay —— 使用者開啟對話 / 送出訊息（規劃文件 §15.1）
// 前端以 supabase.functions.invoke('roleplay', { body }) 呼叫，帶使用者 JWT。
import { handleOptions, json } from '../_shared/cors.ts';

interface RoleplayRequest {
  sessionId?: string;   // 沒有則建立新 session
  characterId: string;
  message: string;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const _body = (await req.json()) as RoleplayRequest;
    // TODO(phase-2):
    // 1. 建立/延續 session，存 user message
    // 2. 載入分層上下文 + 檢索相關記憶（composeRoleplaySystemPrompt）
    // 3. chat() 產生回覆
    // 4. 存 assistant message，回傳
    return json({ error: 'not implemented' }, 501);
  } catch (err) {
    return json({ error: String(err) }, 400);
  }
});
