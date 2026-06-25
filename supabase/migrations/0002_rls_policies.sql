-- =============================================================
-- Row Level Security
-- 前端（GitHub Pages）只持有公開的 anon key，因此 RLS 是安全底線。
-- 原則：
--   * 所有「特權寫入」都走 Edge Functions（service-role，繞過 RLS）。
--   * anon / authenticated 前端原則上「只讀自己有權限的資料」，不直接寫。
--   * 角色 / 世界 canon 視為對已登入者可讀（單一創作者 MVP）；
--     正式多租戶時應加 owner_id 並收斂下列 policy（見 docs/plan.md P1 / P7）。
-- =============================================================

alter table worlds                       enable row level security;
alter table world_states                 enable row level security;
alter table characters                   enable row level security;
alter table character_canon_amendments   enable row level security;
alter table world_amendments             enable row level security;
alter table sessions                     enable row level security;
alter table messages                     enable row level security;
alter table life_entries                 enable row level security;
alter table relationship_threads         enable row level security;
alter table memory_entries               enable row level security;
alter table summaries                    enable row level security;
alter table memory_embeddings            enable row level security;

-- 共享 canon：已登入者可讀（寫入只由 service-role 經 Edge Function 進行）
create policy "read worlds"        on worlds                     for select to authenticated using (true);
create policy "read world_states"  on world_states               for select to authenticated using (true);
create policy "read characters"    on characters                 for select to authenticated using (true);
create policy "read char_amend"    on character_canon_amendments for select to authenticated using (true);
create policy "read world_amend"   on world_amendments           for select to authenticated using (true);

-- 使用者私有資料：只能存取自己的
create policy "own sessions"  on sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own messages"  on messages
  for select to authenticated
  using (exists (select 1 from sessions s where s.id = messages.session_id and s.user_id = auth.uid()));

create policy "own relationship" on relationship_threads
  for select to authenticated using (user_id = auth.uid());

-- Life Timeline：自主日記（無關聯使用者）對已登入者可讀；
-- 與使用者相關的 interaction entry 僅該使用者可讀。
create policy "read autonomous entries" on life_entries
  for select to authenticated using (related_user_id is null);
create policy "read own interaction entries" on life_entries
  for select to authenticated using (related_user_id = auth.uid());

-- memory / summary：MVP 視為角色層級，對已登入者可讀（之後可按角色擁有者收斂）
create policy "read memory"    on memory_entries for select to authenticated using (true);
create policy "read summaries" on summaries      for select to authenticated using (true);

-- memory_embeddings 不開放前端直接查詢；檢索一律經 Edge Function 的 RPC（service-role）。
