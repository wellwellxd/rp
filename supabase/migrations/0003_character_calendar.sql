-- =============================================================
-- 角色內在曆法（Character Calendar）
-- 設計：每個角色有一個「初始日期」(initial_date)，其生活時間線從這天起算。
--       每開一段新 session，就是角色生命中的「下一天」(session_date)。
--       日記（interaction life_entry）會用該 session 的 session_date 當 entry_date。
-- 推進規則：新 session 的日期 = 角色時間線目前最後一天 + 1。
--           「目前最後一天」取 initial_date、life_entries 最大 entry_date、
--           sessions 最大 session_date 三者的最大值——如此未來「角色自行渡過一天」
--           （寫入一篇較晚日期的 life_entry，無 session）也能自然推進日曆。
-- =============================================================

-- ── characters：初始日期 ─────────────────────────────────────
alter table characters
  add column if not exists initial_date date not null default current_date;

-- 既有角色：把 initial_date 對齊其最新一篇生活記錄（種子角色落在 current_date）。
update characters c
set initial_date = coalesce(
  (select max(le.entry_date) from life_entries le where le.character_id = c.id),
  c.initial_date
);

-- ── sessions：該段對話發生在角色生命中的哪一天 ────────────────
alter table sessions
  add column if not exists session_date date;

-- 自動推進 session_date：插入時若未指定，取角色時間線最後一天 + 1。
-- security definer：繞過 RLS 讀取角色「整體」時間線（跨使用者的共享生活線）。
create or replace function set_session_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_day date;
begin
  if new.session_date is null then
    select greatest(
      c.initial_date,
      coalesce((select max(le.entry_date) from life_entries le where le.character_id = new.character_id), c.initial_date),
      coalesce((select max(s.session_date) from sessions s where s.character_id = new.character_id), c.initial_date)
    )
    into last_day
    from characters c
    where c.id = new.character_id;

    new.session_date := last_day + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_session_date on sessions;
create trigger trg_set_session_date
  before insert on sessions
  for each row execute function set_session_date();

-- 既有 sessions 回填：依建立順序，每段往後一天（initial_date + 1, +2, …）。
with ordered as (
  select s.id,
         c.initial_date + (row_number() over (partition by s.character_id order by s.started_at))::int as d
  from sessions s
  join characters c on c.id = s.character_id
  where s.session_date is null
)
update sessions s
set session_date = o.d
from ordered o
where o.id = s.id;
