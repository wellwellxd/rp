-- =============================================================
-- World-aware Character Memory System — initial schema
-- 設計原則：Append-only memory。canon / world / memory 皆「續寫不改寫」。
-- 對應規劃文件 §14 建議資料表。
-- =============================================================

create extension if not exists "uuid-ossp";
create extension if not exists vector;  -- pgvector，記憶檢索

-- ── ENUMs ────────────────────────────────────────────────────
create type source_type as enum ('autonomous', 'interaction', 'mixed');
create type user_presence_level as enum (
  'none',                  -- 完全沒有使用者
  'remembered',            -- 角色單方面想起，無新互動
  'referenced',            -- 向 NPC / 日記低度提及，不揭露隱私
  'interaction',           -- 使用者實際發起互動（僅 session 可觸發）
  'forbidden_fabrication'  -- 禁止狀態：保留作為 guard 標記，不應寫入正式 entry
);
create type drama_level as enum ('low', 'medium', 'high');
create type canon_impact as enum ('none', 'minor', 'candidate');

-- ── worlds：世界根本設定（World Canon，§4.1）────────────────
create table worlds (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  world_canon text not null,        -- 世界類型、時代、不可違反限制
  geography text,
  social_rules text,
  technology_level text,
  magic_rules text,
  daily_life_rules text,
  forbidden_events text,            -- 禁止自動生成的重大事件
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── world_states：當前世界狀態（World State，§4.2，可變但受控）─
create table world_states (
  id uuid primary key default uuid_generate_v4(),
  world_id uuid not null references worlds(id) on delete cascade,
  world_date date not null,         -- 世界當前日期（current_date 是保留字，故改名）
  season text,
  weather_pattern text,
  location_state text,
  public_events text,
  minor_world_events text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_world_states_world on world_states(world_id, world_date desc);

-- ── characters：角色核心設定（Character Canon，§4.3）─────────
create table characters (
  id uuid primary key default uuid_generate_v4(),
  world_id uuid not null references worlds(id) on delete cascade,
  name text not null,
  persona_core text not null,
  backstory text,
  core_values text,                 -- values 是保留字，故改名
  voice_style text,
  occupation text,
  routine text,
  relationship_rules text,          -- 不可違反的行為邊界
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_characters_world on characters(world_id);

-- ── character_canon_amendments：人格續寫（§12.3，append-only）─
create table character_canon_amendments (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  content text not null,
  reason text,
  source_entry_ids uuid[] default '{}',
  valid_from timestamptz not null default now(),
  priority int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_char_amendments_char on character_canon_amendments(character_id, valid_from);

-- ── world_amendments：世界續寫（§12.4，append-only）──────────
create table world_amendments (
  id uuid primary key default uuid_generate_v4(),
  world_id uuid not null references worlds(id) on delete cascade,
  content text not null,
  reason text,
  source_entry_ids uuid[] default '{}',
  valid_from timestamptz not null default now(),
  priority int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_world_amendments_world on world_amendments(world_id, valid_from);

-- ── sessions：對話現場（§2.3，結束後整理成日記）─────────────
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  session_status text not null default 'active',  -- active | ended | summarized
  created_at timestamptz not null default now()
);
create index idx_sessions_char_user on sessions(character_id, user_id, started_at desc);

-- ── messages：session 內訊息 ─────────────────────────────────
create table messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null,               -- user | assistant | system
  content text not null,
  token_count int,
  emotional_tags text[],
  created_at timestamptz not null default now()
);
create index idx_messages_session on messages(session_id, created_at);

-- ── life_entries：角色生活時間線（Life Timeline，§5 / §14.8）─
create table life_entries (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  world_id uuid not null references worlds(id) on delete cascade,
  entry_date date not null,
  title text,
  content text not null,
  structured_json jsonb,
  source_type source_type not null,
  user_presence_level user_presence_level not null default 'none',
  user_agency_created boolean not null default false,  -- 只有真實 session 才可為 true
  related_user_id uuid references auth.users(id) on delete set null,
  related_session_id uuid references sessions(id) on delete set null,
  drama_level drama_level not null default 'low',
  canon_impact canon_impact not null default 'none',
  emotional_state text,
  location text,
  involved_npcs text[],
  world_state_refs uuid[] default '{}',
  importance_score real default 0,
  created_at timestamptz not null default now()
);
create index idx_life_entries_char_date on life_entries(character_id, entry_date desc);
create index idx_life_entries_source on life_entries(character_id, source_type);
-- guard：autonomous / mixed-自主段不得宣稱使用者主動性
alter table life_entries add constraint chk_user_agency_source
  check (not (user_agency_created and source_type = 'autonomous'));

-- ── relationship_threads：使用者關係線（§4.5，Timeline 的索引/摘要）─
create table relationship_threads (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_stage text,
  trust_level real default 0,
  shared_memory_summary text,
  unresolved_threads text,
  updated_at timestamptz not null default now(),
  unique (character_id, user_id)
);

-- ── memory_entries：長期記憶（§12 / §14.10，append-only）─────
create table memory_entries (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  memory_type text not null,        -- fact | belief | preference | relationship | world ...
  content text not null,
  source_entry_ids uuid[] default '{}',
  valid_from timestamptz not null default now(),
  -- 不代表刪除舊記憶，僅表示「在當前理解上優先於」
  supersedes_memory_id uuid references memory_entries(id) on delete set null,
  -- 此記憶是對某條舊記憶的新「解釋」
  interpretation_of_memory_id uuid references memory_entries(id) on delete set null,
  confidence_score real default 0.5,
  canon_impact canon_impact not null default 'none',
  created_at timestamptz not null default now()
);
create index idx_memory_entries_char on memory_entries(character_id, memory_type, valid_from desc);

-- ── summaries：daily / weekly / monthly 彙整（§11）───────────
create table summaries (
  id uuid primary key default uuid_generate_v4(),
  character_id uuid not null references characters(id) on delete cascade,
  period text not null,             -- daily | weekly | monthly
  period_start date not null,
  period_end date not null,
  content text not null,
  structured_json jsonb,
  promotes_to_canon boolean not null default false,  -- 是否產生 canon amendment candidate
  created_at timestamptz not null default now(),
  unique (character_id, period, period_start)
);
create index idx_summaries_char on summaries(character_id, period, period_start desc);

-- ── memory_embeddings：向量檢索（§14.11，pgvector）──────────
-- 維度需與 EMBEDDING_DIM 一致（預設 1536）。換模型 → 新 migration 調整維度。
create table memory_embeddings (
  id uuid primary key default uuid_generate_v4(),
  source_type text not null,        -- life_entry | memory_entry | summary
  source_id uuid not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index idx_memory_embeddings_vec on memory_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index idx_memory_embeddings_source on memory_embeddings(source_type, source_id);
