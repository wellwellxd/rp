// POST /functions/v1/session-summary —— Session 結束後整理成 interaction 日記
// （規劃文件 §10 / §15.2）。可由前端「結束對話」或排程觸發。
import { handleOptions, json } from '../_shared/cors.ts';

interface SessionSummaryRequest {
  sessionId: string;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const _body = (await req.json()) as SessionSummaryRequest;
    // TODO(phase-3):
    // 1. 讀 session messages → 摘要
    // 2. 產生 interaction life entry
    //    （source_type=interaction, user_presence_level=interaction, user_agency_created=true）
    // 3. 更新 relationship_thread
    // 4. 評估記憶 / canon candidate（append-only）+ embedding
    return json({ error: 'not implemented' }, 501);
  } catch (err) {
    return json({ error: String(err) }, 400);
  }
});
