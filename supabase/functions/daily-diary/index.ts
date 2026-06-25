// POST /functions/v1/daily-diary —— 每日自動日記（規劃文件 §7 / §15.3）
// 由 Supabase Cron 每日觸發（pg_cron + pg_net）。對每個活躍角色產生保守日記。
// 此 function 用 service-role，且必須通過 guard 才寫入。
import { handleOptions, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    // TODO(phase-4):
    // for each active character:
    //   1. 檢查今日是否已有 entry
    //   2. composeDiarySystemPrompt + chat() 生成
    //   3. validateAutonomousEntry（user_agency 必為 false、drama low、無禁止事件）
    //   4. 通過才寫入 life_entries + embedding
    return json({ error: 'not implemented' }, 501);
  } catch (err) {
    return json({ error: String(err) }, 400);
  }
});
