// POST /functions/v1/roleplay —— 使用者對話（規劃文件 §15.1）
// 載入角色 canon（DB）→ 呼叫 OpenRouter → 把本輪 user/assistant 訊息寫入 DB。
// 需要登入（verify_jwt 開啟）；所有 DB 操作以 service-role 進行。
import { handleOptions, json } from '../_shared/cors.ts';
import { chat } from '../_shared/openrouter.ts';
import { getServiceClient, getUserClient } from '../_shared/supabase.ts';

const MODEL = Deno.env.get('MODEL_ROLEPLAY') ?? 'anthropic/claude-sonnet-4.6';

interface RoleplayRequest {
  characterId: string;
  sessionId?: string;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

// deno-lint-ignore no-explicit-any
function buildSystemPrompt(character: any, world: any, state: any, life: any[]): string {
  const lifeText = (life ?? [])
    .map((e) => `- ${e.entry_date}：${e.content}`)
    .join('\n') || '（最近沒有特別記錄。）';
  const stateText = state
    ? `目前是${state.season ?? ''}，${state.weather_pattern ?? ''}。${state.location_state ?? ''}`
    : '';
  return `你是「${character.name}」，一個生活在「${world?.name ?? ''}」這個世界裡的角色。請完全以${character.name}的身分、用第一人稱回應，不要像 AI 助理。

【世界 · ${world?.name ?? ''}】
${world?.world_canon ?? ''}
${stateText}

【你是誰】
${character.occupation ? character.occupation + '。' : ''}${character.persona_core}
${character.voice_style ? '說話風格：' + character.voice_style : ''}

【你最近的生活】
${lifeText}

【回應原則】
1. 你有自己的生活，使用者只是其中一部分，不是全部。若自然，可簡短提起近期生活，但不要像報告一樣全列出來。
2. 不要假裝使用者做過你不知道的事；不要替使用者創造行為、訊息、承諾或共同回憶。
3. 保持你的語氣，低戲劇性，不要過度熱情或長篇大論。
4. 用繁體中文回應。`;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const body = (await req.json()) as RoleplayRequest;
    if (!body.characterId || !body.message?.trim()) {
      return json({ error: 'characterId and message are required' }, 400);
    }

    // 確認呼叫者身分
    const { data: userData, error: uErr } = await getUserClient(req).auth.getUser();
    if (uErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    const svc = getServiceClient();

    // 載入角色 canon
    const { data: character } = await svc
      .from('characters').select('*').eq('id', body.characterId).single();
    if (!character) return json({ error: 'character not found' }, 404);

    const { data: world } = await svc
      .from('worlds').select('*').eq('id', character.world_id).single();
    const { data: states } = await svc
      .from('world_states').select('*')
      .eq('world_id', character.world_id)
      .order('world_date', { ascending: false }).limit(1);
    const { data: life } = await svc
      .from('life_entries').select('entry_date, content')
      .eq('character_id', body.characterId)
      .order('entry_date', { ascending: false }).limit(3);

    const system = buildSystemPrompt(character, world, states?.[0] ?? null, life ?? []);
    const conversation =
      body.history && body.history.length > 0
        ? body.history
        : [{ role: 'user' as const, content: body.message }];

    const reply = await chat({ model: MODEL, system, messages: conversation });

    // 持久化本輪訊息（確認 session 屬於該使用者後才寫）
    if (body.sessionId) {
      const { data: sess } = await svc
        .from('sessions').select('id, user_id').eq('id', body.sessionId).single();
      if (sess && sess.user_id === userId) {
        await svc.from('messages').insert([
          { session_id: body.sessionId, role: 'user', content: body.message },
          { session_id: body.sessionId, role: 'assistant', content: reply },
        ]);
      }
    }

    return json({ reply });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
