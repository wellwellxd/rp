// POST /functions/v1/periodic-summary —— 週 / 月彙整（規劃文件 §11 / §15.4）
// 由 Supabase Cron 觸發（每週、每月各一條）。body 指定 period。
import { handleOptions, json } from '../_shared/cors.ts';

interface PeriodicSummaryRequest {
  period: 'weekly' | 'monthly';
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const _body = (await req.json()) as PeriodicSummaryRequest;
    // TODO(phase-6):
    // 1. 讀取週期內 entries → 生成 summary
    // 2. 偵測反覆情緒 / 生活節奏 / 關係變化 / 人格演化候選
    // 3. 任何「變化」一律新增 amendment（append-only），不改寫舊 canon
    return json({ error: 'not implemented' }, 501);
  } catch (err) {
    return json({ error: String(err) }, 400);
  }
});
