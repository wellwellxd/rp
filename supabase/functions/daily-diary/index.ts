// POST /functions/v1/daily-diary —— 角色自行渡過一天，產生一篇保守的 autonomous 日記。
// （規劃文件 §7 / §15.3）。手動觸發（帶 characterId）或排程觸發（不帶 → 處理全部角色）。
// 日記日期 = 角色時間線最後一天 + 1，寫入後 sessions 的曆法 trigger 會自動往後對齊。
import { handleOptions, json } from '../_shared/cors.ts';
import { chat } from '../_shared/openrouter.ts';
import { getServiceClient, getUserClient } from '../_shared/supabase.ts';
import { validateAutonomousEntry } from '../_shared/guard.ts';

const DEFAULT_MODEL = Deno.env.get('MODEL_DIARY') ?? Deno.env.get('MODEL_ROLEPLAY') ??
  'anthropic/claude-sonnet-4.6';

interface DailyDiaryRequest {
  characterId?: string; // 省略＝處理全部角色（供排程）
}

interface DiaryDraft {
  title?: string;
  content: string;
  emotional_state?: string;
  location?: string;
  involved_npcs?: string[];
}

// deno-lint-ignore no-explicit-any
function buildPrompt(character: any, world: any, state: any, recent: any[], date: string): string {
  const recentText = (recent ?? [])
    .map((e) => `- ${e.entry_date}：${e.content}`)
    .join('\n') || '（沒有更早的記錄。）';
  const stateText = state
    ? `目前是${state.season ?? ''}，${state.weather_pattern ?? ''}。${state.location_state ?? ''}`
    : '';
  return `你是「${character.name}」，生活在「${world?.name ?? ''}」這個世界裡。
請以第一人稱，寫下你在 ${date} 這一天、沒有任何訪客時的平常生活日記。

【世界 · ${world?.name ?? ''}】
${world?.world_canon ?? ''}
${stateText}

【你是誰】
${character.occupation ? character.occupation + '。' : ''}${character.persona_core}
${character.voice_style ? '書寫風格：' + character.voice_style : ''}

【你最近幾天的生活】
${recentText}

【寫今天日記的原則（非常重要）】
1. 這是平凡的一天，延續你最近的生活節奏。低戲劇性：頂多 0～2 件小事，沒有重大事件。
2. 絕對不要寫到任何使用者／訪客；今天沒有人來找你。不要編造和別人的約定或共同經歷。
3. 不可出現重大或不可逆事件：死亡、告白、結婚、搬家、離職、意外、懷孕等，一律不准。
4. 可以寫你做的小事、觀察到的細節、心裡的念頭與感受，但保持節制、貼近你的個性。
5. 用繁體中文。

只輸出一個 JSON 物件（不要任何額外文字或 markdown 圍欄）：
{
  "title": "一句話小標題",
  "content": "日記正文（第一人稱，數句到一小段）",
  "emotional_state": "今天的整體情緒（簡短）",
  "location": "今天主要待的地方",
  "involved_npcs": ["若有提到的配角名字，沒有就空陣列"]
}`;
}

function parseDiary(raw: string): DiaryDraft {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      if (obj && typeof obj.content === 'string' && obj.content.trim()) return obj as DiaryDraft;
    } catch (_) { /* fallthrough */ }
  }
  return { content: raw.trim() };
}

// 角色時間線最後一天 + 1（取 initial_date / life_entries / sessions 三者最大值）。
// deno-lint-ignore no-explicit-any
async function nextDate(svc: any, characterId: string, initialDate: string): Promise<string> {
  const { data: le } = await svc
    .from('life_entries').select('entry_date')
    .eq('character_id', characterId)
    .order('entry_date', { ascending: false }).limit(1);
  const { data: ss } = await svc
    .from('sessions').select('session_date')
    .eq('character_id', characterId)
    .order('session_date', { ascending: false }).limit(1);
  const days = [initialDate, le?.[0]?.entry_date, ss?.[0]?.session_date].filter(Boolean) as string[];
  const last = days.sort()[days.length - 1]; // YYYY-MM-DD 字典序＝日期序
  const d = new Date(last + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// deno-lint-ignore no-explicit-any
async function passOneDay(svc: any, character: any) {
  const { data: world } = await svc
    .from('worlds').select('*').eq('id', character.world_id).single();
  const { data: states } = await svc
    .from('world_states').select('*')
    .eq('world_id', character.world_id)
    .order('world_date', { ascending: false }).limit(1);
  const { data: recent } = await svc
    .from('life_entries').select('entry_date, content')
    .eq('character_id', character.id)
    .order('entry_date', { ascending: false }).limit(6);

  const date = await nextDate(svc, character.id, character.initial_date);
  const prompt = buildPrompt(character, world, states?.[0] ?? null, recent ?? [], date);
  const model = (character.model ?? '').trim() || DEFAULT_MODEL;
  const reply = await chat({
    model,
    system: prompt,
    messages: [{ role: 'user', content: `請寫下 ${date} 的日記。` }],
    temperature: 0.85,
  });
  const draft = parseDiary(reply);

  // 守門員：自動日記的安全底線
  const candidate = {
    content: draft.content,
    userAgencyCreated: false as const,
    userPresenceLevel: 'none' as const,
    dramaLevel: 'low' as const,
  };
  const verdict = validateAutonomousEntry(candidate);
  if (!verdict.ok) {
    return { ok: false as const, characterId: character.id, date, violations: verdict.violations };
  }

  const { data: entry, error } = await svc
    .from('life_entries')
    .insert({
      character_id: character.id,
      world_id: character.world_id,
      entry_date: date,
      title: draft.title ?? null,
      content: draft.content,
      source_type: 'autonomous',
      user_presence_level: 'none',
      user_agency_created: false,
      drama_level: 'low',
      emotional_state: draft.emotional_state ?? null,
      location: draft.location ?? null,
      involved_npcs: Array.isArray(draft.involved_npcs) ? draft.involved_npcs : null,
    })
    .select('id, entry_date, title, content, emotional_state, location')
    .single();
  if (error) return { ok: false as const, characterId: character.id, date, violations: [error.message] };
  return { ok: true as const, entry };
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const body = (await req.json().catch(() => ({}))) as DailyDiaryRequest;

    const { data: userData, error: uErr } = await getUserClient(req).auth.getUser();
    if (uErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    const svc = getServiceClient();

    if (body.characterId) {
      const { data: character } = await svc
        .from('characters').select('*').eq('id', body.characterId).single();
      if (!character) return json({ error: 'character not found' }, 404);
      const result = await passOneDay(svc, character);
      if (!result.ok) {
        return json({ error: `守門員擋下了這篇日記：${result.violations.join('；')}（請再試一次）`, ...result }, 422);
      }
      return json(result);
    }

    // 無 characterId：處理全部角色（供排程；逐一產生）
    const { data: characters } = await svc.from('characters').select('*');
    const results = [];
    for (const ch of characters ?? []) {
      try {
        results.push(await passOneDay(svc, ch));
      } catch (e) {
        results.push({ ok: false, characterId: ch.id, violations: [String(e)] });
      }
    }
    return json({ results });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
