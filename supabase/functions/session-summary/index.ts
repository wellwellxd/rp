// POST /functions/v1/session-summary —— Session 結束後整理成 interaction 日記
// （規劃文件 §10 / §15.2）。由前端「整理成日記」按鈕觸發。
//
// 流程：驗證使用者擁有該 session → 讀訊息 → LLM 以角色第一人稱寫當天日記（JSON）
//   → 寫入 life_entries（source_type=interaction / user_presence_level=interaction
//     / user_agency_created=true，唯一正當設 true 的路徑）
//   → 標記 session 為 summarized（鎖成唯讀）→ upsert relationship_thread。
// 具冪等性：已整理過的 session 直接回傳既有日記，不重複寫入。
import { handleOptions, json } from '../_shared/cors.ts';
import { chat } from '../_shared/openrouter.ts';
import { getServiceClient, getUserClient } from '../_shared/supabase.ts';

const DEFAULT_MODEL = Deno.env.get('MODEL_SUMMARY') ?? Deno.env.get('MODEL_ROLEPLAY') ??
  'anthropic/claude-sonnet-4.6';

interface SessionSummaryRequest {
  sessionId: string;
}

interface DiaryDraft {
  title?: string;
  content: string;
  emotional_state?: string;
  location?: string;
  drama_level?: 'low' | 'medium' | 'high';
  relationship_summary?: string;
  unresolved_threads?: string;
}

// deno-lint-ignore no-explicit-any
function buildDiaryPrompt(character: any, world: any, sessionDate: string, transcript: string): string {
  return `你是「${character.name}」，生活在「${world?.name ?? ''}」這個世界裡。
今天是 ${sessionDate}。一天結束時，你會在自己的日記本上，用第一人稱、私密的口吻，記下今天和對方相處的這段時間。

【你是誰】
${character.occupation ? character.occupation + '。' : ''}${character.persona_core}
${character.voice_style ? '說話／書寫風格：' + character.voice_style : ''}

【今天的對話（你＝${character.name}，對方＝來找你的人）】
${transcript}

【寫日記的原則】
1. 只根據真的發生過的對話來寫，不要捏造對方沒做過、沒說過的事，也不要替對方創造行為或承諾。
2. 第一人稱、低戲劇性、貼近你平常的語氣，像真的在寫給自己看的日記。
3. 可以寫下你當下的感受、注意到的小細節、心裡浮現的想法，但保持節制。
4. 用繁體中文。

只輸出一個 JSON 物件（不要任何額外文字或 markdown 圍欄），格式如下：
{
  "title": "一句話小標題",
  "content": "日記正文（第一人稱，數句到一小段）",
  "emotional_state": "今天的整體情緒，數字以內的詞",
  "location": "今天主要待的地方",
  "drama_level": "low | medium | high（保守相處通常是 low）",
  "relationship_summary": "對這位來訪者，可長期保留的低敏感關係摘要（不揭露隱私細節）",
  "unresolved_threads": "尚未了結、之後可能想再聊的線（沒有就空字串）"
}`;
}

function parseDiary(raw: string): DiaryDraft {
  let text = raw.trim();
  // 去掉可能的 ```json ... ``` 圍欄
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) text = fence[1].trim();
  // 取第一個 { 到最後一個 }，容忍前後雜訊
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      if (obj && typeof obj.content === 'string' && obj.content.trim()) {
        return obj as DiaryDraft;
      }
    } catch (_) { /* fallthrough */ }
  }
  // 解析失敗：把整段回覆當作日記正文，保守標記。
  return { content: raw.trim(), drama_level: 'low' };
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const body = (await req.json()) as SessionSummaryRequest;
    if (!body.sessionId) return json({ error: 'sessionId is required' }, 400);

    // 確認呼叫者身分
    const { data: userData, error: uErr } = await getUserClient(req).auth.getUser();
    if (uErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    const svc = getServiceClient();

    // 載入 session，並確認屬於該使用者
    const { data: session } = await svc
      .from('sessions')
      .select('id, user_id, character_id, session_date, session_status')
      .eq('id', body.sessionId)
      .single();
    if (!session) return json({ error: 'session not found' }, 404);
    if (session.user_id !== userId) return json({ error: 'forbidden' }, 403);

    // 冪等：已整理過就回傳既有日記
    const { data: existing } = await svc
      .from('life_entries')
      .select('id, entry_date, title, content, emotional_state, location')
      .eq('related_session_id', session.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existing && existing.length > 0) {
      return json({ alreadySummarized: true, entry: existing[0] });
    }

    // 讀對話訊息
    const { data: msgs } = await svc
      .from('messages')
      .select('role, content')
      .eq('session_id', session.id)
      .order('created_at');
    const turns = (msgs ?? []).filter((m) => m.role === 'user' || m.role === 'assistant');
    if (turns.length === 0) {
      return json({ error: 'no messages to summarize' }, 400);
    }

    // 載入角色 / 世界 canon
    const { data: character } = await svc
      .from('characters').select('*').eq('id', session.character_id).single();
    if (!character) return json({ error: 'character not found' }, 404);
    const { data: world } = await svc
      .from('worlds').select('*').eq('id', character.world_id).single();

    const sessionDate: string = session.session_date ?? character.initial_date;
    const transcript = turns
      .map((m) => `${m.role === 'user' ? '對方' : character.name}：${m.content}`)
      .join('\n');

    const prompt = buildDiaryPrompt(character, world, sessionDate, transcript);
    const model = (character.model ?? '').trim() || DEFAULT_MODEL;
    const reply = await chat({
      model,
      system: prompt,
      messages: [{ role: 'user', content: '請寫下今天的日記。' }],
      temperature: 0.7,
    });
    const diary = parseDiary(reply);
    const drama = diary.drama_level === 'medium' || diary.drama_level === 'high'
      ? diary.drama_level
      : 'low';

    // 寫入 interaction life entry（日期 = 該 session 的角色當天日期）
    const { data: entry, error: insErr } = await svc
      .from('life_entries')
      .insert({
        character_id: character.id,
        world_id: character.world_id,
        entry_date: sessionDate,
        title: diary.title ?? null,
        content: diary.content,
        source_type: 'interaction',
        user_presence_level: 'interaction',
        user_agency_created: true,
        related_user_id: userId,
        related_session_id: session.id,
        drama_level: drama,
        emotional_state: diary.emotional_state ?? null,
        location: diary.location ?? null,
      })
      .select('id, entry_date, title, content, emotional_state, location')
      .single();
    if (insErr) return json({ error: `insert life_entry failed: ${insErr.message}` }, 500);

    // 標記 session 為已整理（前端據此鎖成唯讀）
    await svc
      .from('sessions')
      .update({ session_status: 'summarized', ended_at: new Date().toISOString() })
      .eq('id', session.id);

    // 更新使用者關係線（低敏感摘要）
    if (diary.relationship_summary || diary.unresolved_threads) {
      await svc.from('relationship_threads').upsert(
        {
          character_id: character.id,
          user_id: userId,
          shared_memory_summary: diary.relationship_summary ?? null,
          unresolved_threads: diary.unresolved_threads || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'character_id,user_id' },
      );
    }

    return json({ entry });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
