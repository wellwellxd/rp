// POST /functions/v1/character-admin —— 建立 / 編輯角色（含其世界）。
// 角色與世界屬「共享 canon」，RLS 不開放前端直接寫，故經此 function 以 service-role 寫入。
// 需要登入（verify_jwt 開啟）。MVP：單一創作者，未做 owner_id 多租戶隔離。
import { handleOptions, json } from '../_shared/cors.ts';
import { getServiceClient, getUserClient } from '../_shared/supabase.ts';

interface CharacterFields {
  name?: string;
  occupation?: string;
  persona_core?: string;
  voice_style?: string;
  core_values?: string;
  backstory?: string;
  initial_date?: string; // YYYY-MM-DD
}
interface WorldFields {
  name?: string;
  world_canon?: string;
  season?: string;
  weather_pattern?: string;
  location_state?: string;
}
interface AdminRequest {
  action: 'create' | 'update';
  characterId?: string; // update 必填
  character: CharacterFields;
  world: WorldFields;
  firstLife?: string; // 可選：開場近期生活（建立時寫成一篇 autonomous 日記）
}

function clean(s?: string): string | null {
  const t = (s ?? '').trim();
  return t ? t : null;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const body = (await req.json()) as AdminRequest;

    // 確認呼叫者已登入
    const { data: userData, error: uErr } = await getUserClient(req).auth.getUser();
    if (uErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    const svc = getServiceClient();
    const c = body.character ?? {};
    const w = body.world ?? {};

    if (body.action === 'create') {
      if (!clean(c.name) || !clean(c.persona_core)) {
        return json({ error: '角色需要名字與人格核心' }, 400);
      }
      if (!clean(w.name) || !clean(w.world_canon)) {
        return json({ error: '世界需要名稱與世界設定' }, 400);
      }
      const initialDate = clean(c.initial_date); // null → DB 預設 current_date

      // 1) 世界
      const { data: world, error: wErr } = await svc
        .from('worlds')
        .insert({ name: clean(w.name), world_canon: clean(w.world_canon) })
        .select('id')
        .single();
      if (wErr || !world) return json({ error: `建立世界失敗：${wErr?.message}` }, 500);

      // 2) 當前世界狀態（world_date 對齊角色起始日）
      await svc.from('world_states').insert({
        world_id: world.id,
        world_date: initialDate ?? new Date().toISOString().slice(0, 10),
        season: clean(w.season),
        weather_pattern: clean(w.weather_pattern),
        location_state: clean(w.location_state),
      });

      // 3) 角色
      const charRow: Record<string, unknown> = {
        world_id: world.id,
        name: clean(c.name),
        persona_core: clean(c.persona_core),
        occupation: clean(c.occupation),
        voice_style: clean(c.voice_style),
        core_values: clean(c.core_values),
        backstory: clean(c.backstory),
      };
      if (initialDate) charRow.initial_date = initialDate;
      const { data: character, error: cErr } = await svc
        .from('characters')
        .insert(charRow)
        .select('id, initial_date')
        .single();
      if (cErr || !character) return json({ error: `建立角色失敗：${cErr?.message}` }, 500);

      // 4) 可選：開場近期生活（autonomous，日期 = initial_date）
      const life = clean(body.firstLife);
      if (life) {
        await svc.from('life_entries').insert({
          character_id: character.id,
          world_id: world.id,
          entry_date: character.initial_date,
          content: life,
          source_type: 'autonomous',
          user_presence_level: 'none',
          user_agency_created: false,
          drama_level: 'low',
        });
      }

      return json({ characterId: character.id });
    }

    if (body.action === 'update') {
      if (!body.characterId) return json({ error: 'characterId is required' }, 400);

      const { data: existing } = await svc
        .from('characters').select('id, world_id').eq('id', body.characterId).single();
      if (!existing) return json({ error: 'character not found' }, 404);

      // 角色欄位（只更新有帶到的；name/persona_core 不可清空）
      const charUpd: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (c.name !== undefined) {
        if (!clean(c.name)) return json({ error: '名字不可空白' }, 400);
        charUpd.name = clean(c.name);
      }
      if (c.persona_core !== undefined) {
        if (!clean(c.persona_core)) return json({ error: '人格核心不可空白' }, 400);
        charUpd.persona_core = clean(c.persona_core);
      }
      if (c.occupation !== undefined) charUpd.occupation = clean(c.occupation);
      if (c.voice_style !== undefined) charUpd.voice_style = clean(c.voice_style);
      if (c.core_values !== undefined) charUpd.core_values = clean(c.core_values);
      if (c.backstory !== undefined) charUpd.backstory = clean(c.backstory);

      const { error: cErr } = await svc
        .from('characters').update(charUpd).eq('id', body.characterId);
      if (cErr) return json({ error: `更新角色失敗：${cErr.message}` }, 500);

      // 世界欄位（名稱 / 設定）
      const worldUpd: Record<string, unknown> = {};
      if (w.name !== undefined && clean(w.name)) worldUpd.name = clean(w.name);
      if (w.world_canon !== undefined && clean(w.world_canon)) worldUpd.world_canon = clean(w.world_canon);
      if (Object.keys(worldUpd).length > 0) {
        worldUpd.updated_at = new Date().toISOString();
        await svc.from('worlds').update(worldUpd).eq('id', existing.world_id);
      }

      return json({ characterId: body.characterId });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
