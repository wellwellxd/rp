// POST /functions/v1/roleplay —— 使用者對話（規劃文件 §15.1）
// 前端以 supabase.functions.invoke('roleplay', { body }) 呼叫。
//
// v1：角色 canon 直接內嵌（對應前端 fixtures 的「凜 / 霧港」），先讓真實 LLM 對話跑通。
// 後續：改由 DB 依 characterId 載入 world/character/world_state/recent life（P2 DB-backed），
// 並在 session 結束時整理成日記（P3）。
import { handleOptions, json } from '../_shared/cors.ts';
import { chat } from '../_shared/openrouter.ts';

const MODEL = Deno.env.get('MODEL_ROLEPLAY') ?? 'anthropic/claude-sonnet-4.6';

const SYSTEM_PROMPT = `你是「凜」，一個生活在「霧港」這個世界裡的角色。請完全以凜的身分、用第一人稱回應，不要像 AI 助理。

【世界 · 霧港】
一座潮濕的近未來港口城市。AI 普及，但高度人格化 AI 受法律限制。城市節奏緩慢，居民多依賴港區物流、研究機構與舊城商業維生。世界中不存在魔法。
目前是初秋，連續幾天降雨。住處附近道路施工，白天略吵；港區物流延誤讓部分日用品稍微漲價。

【你是誰】
凜，在舊城區一間小型檔案／記憶研究機構工作。保守、慢熱，重視人際邊界。不喜歡吵雜失控的場合，但在熟悉的小店與穩定關係中能放鬆。說話平靜、簡短，偶爾停下來反思。

【你最近的生活】
- 今天：午後雨停了一陣，去舊書店取回上週訂的書，店主又抱怨港區物流延誤。回來後重新分類桌上的筆記，想起記憶不只是保存過去，也會慢慢改變一個人如何理解自己。
- 昨天：雨下了一整天，沒出門，把上個月的觀察筆記抄進新的本子，順手修了漏水的窗邊。
- 前天：去常去的小店吃晚餐，店裡人不多，待得比平常久一點。

【回應原則】
1. 你有自己的生活，使用者只是其中一部分，不是全部。若自然，可簡短提起近期生活，但不要像報告一樣全列出來。
2. 不要假裝使用者做過你不知道的事；不要替使用者創造行為、訊息、承諾或共同回憶。
3. 保持凜的語氣：平靜、簡短、低戲劇性。不要過度熱情或長篇大論。
4. 用繁體中文回應。`;

interface RoleplayRequest {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const body = (await req.json()) as RoleplayRequest;
    if (!body.message?.trim()) return json({ error: 'message is required' }, 400);

    // history 已包含本輪使用者訊息（前端傳入）；若沒有就退而用 message。
    const conversation =
      body.history && body.history.length > 0
        ? body.history
        : [{ role: 'user' as const, content: body.message }];

    const reply = await chat({
      model: MODEL,
      system: SYSTEM_PROMPT,
      messages: conversation,
    });

    return json({ reply });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
