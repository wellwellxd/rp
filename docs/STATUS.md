# 專案現況與接手指南（Handoff）

> 給「新 session 接著做」用的單一事實來源。最後更新：2026-06-25。
> 規劃全貌見 [plan.md](plan.md)；架構見 [architecture.md](architecture.md)。

## 一句話現況

一個手機優先（iOS）的角色扮演 App 已經能**實際運作**：登入 → 選角色 → 開對話 → 角色用真 LLM 回覆 →
對話存進資料庫、可回看每段 session。後端跑在 Supabase（Auth + Postgres + Edge Function），LLM 走 OpenRouter。

## 技術棧 / 架構

```
前端 web/（Vite + React, 手機優先）
   │ 登入(Supabase Auth, email/密碼) → functions.invoke('roleplay')（自動帶 JWT）
   │ 直接讀 DB（characters / 自己的 sessions,messages）受 RLS 約束
   ▼
Supabase（專案 ref: axzgcyxszhaqynxhyxxd）
   ├─ Auth：email/密碼登入
   ├─ Postgres：12 張表 + RLS（migrations 0001, 0002）
   └─ Edge Function `roleplay`（verify_jwt 開啟）
        └─ 載入角色 canon → OpenRouter(claude-sonnet-4.6) → 回覆 + 寫入 messages（service-role）
```

- 前端只持有 **publishable key**（`web/.env`，git-ignored）；OpenRouter key 只在 Edge Function secret。
- 訊息「寫入」只由 function 做（RLS 不開放前端寫 messages）；sessions 由前端在 RLS 下建立。

## 已完成（live，可用）

- ✅ DB schema：12 表 + RLS 全開（`supabase/migrations/0001`,`0002`）
- ✅ 種子資料：兩個角色 **凜/霧港**、**澄/晴町**（`supabase/seed.sql`，idempotent）
- ✅ Email/密碼登入（`Login.tsx` + `lib/auth.ts`）
- ✅ 導覽：**選角色 → session 列表 → 對話**（`views/CharacterList|SessionList|ChatView`）
- ✅ `roleplay` Edge Function：DB 載入角色 + OpenRouter 對話 + 持久化本輪訊息
- ✅ 對話存檔：重整／換裝置後 session 與訊息都還在（已實測）
- ✅ 手機/iOS 樣式（safe-area、16px 輸入不縮放、抽屜顯示角色世界+近期生活）

## 已完成（live，可用）— 本輪新增

- ✅ **A）Session 結束 → 整理成日記**＋**角色內在曆法**（migration 0003 已跑、`session-summary` 已部署）：
  - **角色曆法**：`characters.initial_date`（角色生活時間線起點）、`sessions.session_date`（這段對話發生在角色生命中的哪一天）。
    新 session 的日期 = 角色時間線目前最後一天 +1（trigger 自動算，取 `initial_date` / `life_entries` / `sessions` 三者最大值再 +1，
    未來「角色自行渡過一天」也能自然推進）。種子角色第一段對話 = `initial_date + 1`。
  - **整理成日記**：`session-summary` function 已實作 → 讀訊息 → LLM 第一人稱日記(JSON) → 寫 interaction `life_entry`
    （`source_type=interaction` / `user_presence_level=interaction` / `user_agency_created=true`，日期 = `session_date`）
    → 標記 session `summarized`（前端鎖唯讀）→ upsert `relationship_thread`。冪等。
  - **前端**：ChatView「結束對話並整理成日記」按鈕；summarized session 唯讀並顯示當天日記卡片；SessionList 顯示角色當天日期＋狀態。
  - **現況**：migration 0003 已套用（凜/澄 initial_date=2026-06-25，既有 3 段 session 回填為 06-26/27/28）；`session-summary` 已部署且 verify_jwt 開啟。
    尚未經真實瀏覽器端到端跑過一次（建議下次登入後實測：開新對話→聊幾句→結束整理→確認日記寫入且 session 鎖唯讀）。

## 尚未做（下一步候選）

- ⬜ **B）自動日記**：每日 Cron 觸發 `daily-diary`（stub）；需 guard（`_shared/guard.ts` stub）
- ⬜ **C）部署 GitHub Pages**：workflow 已備（`.github/workflows/deploy-pages.yml`），尚未啟用
- ⬜ **D）角色新增/編輯介面**：目前角色靠 seed.sql 種；前端還沒有建立角色的 UI
- ⬜ 記憶檢索（pgvector）、weekly/monthly 彙整：`memory_embeddings` 表在、邏輯未做
- ⬜ append-only 記憶續寫、canon amendments 的實際運用

## 雲端資源現況

| 項目 | 值 / 狀態 |
|---|---|
| Supabase Project URL | `https://axzgcyxszhaqynxhyxxd.supabase.co` |
| Project ref | `axzgcyxszhaqynxhyxxd` |
| Edge Function | `roleplay` 已部署，**verify_jwt 開啟**（需登入才能呼叫）|
| Function secret | `OPENROUTER_API_KEY` 已設；模型可用 `MODEL_ROLEPLAY` 覆寫（預設 `anthropic/claude-sonnet-4.6`）|
| Auth | email/密碼；測試帳號 `rogermoc@gmail.com`（密碼不入庫，本機自行保管）|
| 匿名登入 | 未啟用（走正式登入）|

> **密鑰原則**：repo 內不存任何 token / OpenRouter key / 密碼。`web/.env`（publishable key）已 git-ignore。
> 每次要部署 function 或改 DB，需臨時產生 Supabase access token（dashboard → Account → Tokens），用完即刪。

## 怎麼跑起來（本機）

```bash
cd web
npm install          # 第一次
npm run dev          # http://localhost:5173/  （手機尺寸開發）
npm run typecheck    # 型別檢查
```
`web/.env` 需有 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`（已在本機，git-ignored）。
未設定時前端會顯示「尚未設定 Supabase」。

## 怎麼改後端 / DB（需臨時 token）

```bash
export SUPABASE_ACCESS_TOKEN=<臨時 token>
# 部署 function（免 Docker）
supabase functions deploy roleplay --project-ref axzgcyxszhaqynxhyxxd
# 設定 secret
supabase secrets set OPENROUTER_API_KEY=... --project-ref axzgcyxszhaqynxhyxxd
```
DB 結構/種子變更：用 Supabase **SQL Editor** 貼 SQL，或用 Management API：
`POST https://api.supabase.com/v1/projects/<ref>/database/query`（body `{"query": "..."}`，Bearer = token）。

## 重要檔案地圖

```
web/src/
  App.tsx                 auth gate + 三層導覽（characters→sessions→chat）
  Login.tsx               email/密碼登入
  lib/supabase.ts         前端 client（publishable key，未設定時為 null）
  lib/auth.ts             signIn / signOut
  lib/api.ts              sendMessage → functions.invoke('roleplay')
  lib/db.ts               characters / sessions / messages / recentLife 讀取
  views/CharacterList.tsx · SessionList.tsx · ChatView.tsx
supabase/
  migrations/0001_initial_schema.sql   12 表 + pgvector + append-only constraint
  migrations/0002_rls_policies.sql     RLS
  migrations/0003_character_calendar.sql  characters.initial_date / sessions.session_date + 自動推進 trigger（🟡 待跑）
  seed.sql                             兩個角色（凜 / 澄），各自帶 initial_date
  functions/roleplay/index.ts          ✅ 已實作（DB-backed + 持久化）
  functions/session-summary/index.ts   ✅ 已實作（🟡 待部署）—— session → interaction 日記
  functions/daily-diary|periodic-summary/   ⬜ 還是 stub
  functions/_shared/  cors · openrouter(已實作 chat) · supabase · types · prompt(stub) · guard(stub)
```

## 已知小狀況（非阻塞）

- **開發模式 HMR 整頁重載**會把導覽狀態重置回角色列表，且重載後元件可能在 auth token 恢復前就查詢一次（偶見 session 數短暫顯示 0）。乾淨重整後正常；正式部署無 HMR，不受影響。
- 本工作環境內建的預覽截圖工具用舊版 WebKit，**渲染不出 React**；請用真實瀏覽器（Chrome/Safari）看 `localhost:5173`。
- `claude-sonnet-4.6` 是 OpenRouter 上實際可用 id；舊的 `claude-3.7-sonnet` 不存在會 404。

## 新 session 開場建議

> 「接續 rp-claude。先讀 docs/STATUS.md。目前已完成 DB-backed 多角色對話與存檔；
> 我想做 ⟨A 日記 / B 自動日記 / C 部署 Pages / D 角色編輯⟩。」

git 最新：`a303bce`（DB-backed chat: character select, session history, persistence）。
