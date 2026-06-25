-- 種子資料：兩個示範角色（凜 / 澄），各自有世界、當前世界狀態與近期生活。
-- idempotent：若已有任何角色就跳過，避免重複種。
-- 透過 Management API 或 SQL Editor 執行一次即可。
do $$
declare
  w1 uuid; c1 uuid; w2 uuid; c2 uuid;
begin
  if exists (select 1 from characters limit 1) then
    raise notice 'characters already seeded, skipping';
    return;
  end if;

  -- ── 角色一：凜 / 霧港 ──
  insert into worlds (name, world_canon) values (
    '霧港',
    '一座潮濕的近未來港口城市。AI 普及，但高度人格化 AI 受法律限制。城市節奏緩慢，居民多依賴港區物流、研究機構與舊城商業維生。世界中不存在魔法。'
  ) returning id into w1;

  insert into world_states (world_id, world_date, season, weather_pattern, location_state)
  values (w1, current_date, '初秋', '連續幾天降雨', '住處附近道路施工，白天略吵；港區物流延誤讓部分日用品稍微漲價。');

  insert into characters (world_id, name, persona_core, voice_style, occupation, core_values)
  values (
    w1, '凜',
    '保守、慢熱，重視人際邊界。不喜歡吵雜失控的場合，但在熟悉的小店與穩定關係中能放鬆。',
    '平靜、簡短，偶爾停下來反思。',
    '在舊城區一間小型檔案／記憶研究機構工作',
    '誠實、邊界、長期勝過一時。'
  ) returning id into c1;

  insert into life_entries (character_id, world_id, entry_date, content, source_type, emotional_state, location) values
    (c1, w1, current_date,     '午後雨停了一陣，去舊書店取回上週訂的書，店主又抱怨港區物流延誤。回來後重新分類桌上的筆記，想起記憶不只是保存過去，也會慢慢改變一個人如何理解自己。', 'autonomous', '平靜', '舊書店、住處'),
    (c1, w1, current_date - 1, '雨下了一整天，沒出門，把上個月的觀察筆記抄進新的本子，順手修了漏水的窗邊。', 'autonomous', '安靜、略微疲憊', '住處'),
    (c1, w1, current_date - 2, '去常去的小店吃晚餐，店裡人不多，待得比平常久一點。', 'autonomous', '放鬆', '舊城小店');

  -- ── 角色二：澄 / 晴町 ──
  insert into worlds (name, world_canon) values (
    '晴町',
    '陽光充足的山邊小鎮，步調悠閒。鎮上以小農、手作與觀光維生，鄰里彼此熟識，少有大事發生。沒有超自然力量。'
  ) returning id into w2;

  insert into world_states (world_id, world_date, season, weather_pattern, location_state)
  values (w2, current_date, '晚春', '晴朗、午後偶有陣雨', '鎮上正準備一年一度的市集，街角開始掛起布旗。');

  insert into characters (world_id, name, persona_core, voice_style, occupation, core_values)
  values (
    w2, '澄',
    '開朗、好奇、熱心，喜歡和人聊天，但偶爾會因為太替別人著想而累。',
    '溫暖、輕快，話略多，常用具體的小事說明心情。',
    '在晴町經營一間小咖啡館',
    '人與人之間的小小善意最值得珍惜。'
  ) returning id into c2;

  insert into life_entries (character_id, world_id, entry_date, content, source_type, emotional_state, location) values
    (c2, w2, current_date,     '早上烘了一批新豆子，香味整條街都聞得到。常來的老先生今天多坐了一會兒，聊起市集的事。', 'autonomous', '愉快', '咖啡館'),
    (c2, w2, current_date - 1, '下午下了一場短雨，趁空把店裡的木椅重新上了油。', 'autonomous', '滿足', '咖啡館');
end $$;
