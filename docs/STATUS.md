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

- 🟡 **B）自動日記（角色自行渡過一天）**：`daily-diary` function 已實作並部署、`_shared/guard.ts` 已實作（硬規則＋關鍵字守門）。
  前端在角色頁有「🌙 讓〈角色〉自己過一天」按鈕（手動觸發），產生 autonomous 日記、日期 = 時間線最後一天 +1、過 guard 才寫入。
  **尚未做**：Supabase Cron（pg_cron + pg_net）每日自動觸發（function 已支援不帶 characterId → 處理全部角色，但 verify_jwt 開著，cron 需另以 service-role/secret 呼叫）。
  guard 為 v1 關鍵字版，之後可加一次 LLM 分類強化。
- ✅ **C）部署 GitHub Pages**：已上線 → **https://wellwellxd.github.io/rp/**（repo `wellwellxd/rp`，push `main` 自動部署）
- ✅ **D）角色新增/編輯介面**：前端可建立／編輯角色（含其世界＋可選開場近期生活）；寫入走 `character-admin` function（service-role）。
  尚未做：刪除角色、共用世界、owner_id 多租戶隔離（目前任何登入者都能改任何角色，單一創作者 MVP 可接受）。
- ✅ **每角色可切換 LLM 模型**（`characters.model`，migration 0004）：編輯表單可選精選 RP 模型或自訂 OpenRouter id；
  空值＝沿用環境預設（`MODEL_ROLEPLAY`/`MODEL_SUMMARY`，預設 `anthropic/claude-sonnet-4.6`）。roleplay 與 session-summary 皆套用該角色模型。
  精選清單（2026-06-26 確認在 OpenRouter 架上）：`z-ai/glm-4.6`、`z-ai/glm-4.7`、`qwen/qwen3-235b-a22b-2507`、`qwen/qwen-2.5-72b-instruct`。
  注意：清單＝目錄存在；實際生成可用性需在 App 內實測（OpenRouter key 只在 function secret，無法本機直接驗）。
- ✅ **RP 排版慣例 + Markdown 對話框**：roleplay 系統提示加入「*星號*=動作/情境敘述」慣例；前端對話泡泡與日記改用 react-markdown
  （remark-gfm + remark-breaks）渲染，`*動作*` 自動顯示為斜體。元件：`web/src/components/Markdown.tsx`。
- ⬜ 記憶檢索（pgvector）、weekly/monthly 彙整：`memory_embeddings` 表在、邏輯未做
- ⬜ append-only 記憶續寫、canon amendments 的實際運用
- ⬜ **CORS 收斂（hardening）**：function 的 `ALLOWED_ORIGIN` 目前未設＝`*`（本機與線上都能呼叫；JWT+RLS 才是真正邊界）。
  要鎖白名單需小改 `_shared/cors.ts` 支援多來源（逐請求回填 Origin），否則鎖單一來源會擋掉 localhost 開發。
- ⬜ workflow 用的 actions 版本觸發 Node 20 deprecation 警告（不影響部署），有空可升 `checkout@v5`/`setup-node@v5`。

## 雲端資源現況

| 項目 | 值 / 狀態 |
|---|---|
| 線上網址（GitHub Pages） | **https://wellwellxd.github.io/rp/**（repo `wellwellxd/rp`，push `main` 自動部署）|
| Pages 設定 | Source = GitHub Actions；Actions Variables：`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_BASE=/rp/` |
| Supabase Project URL | `https://axzgcyxszhaqynxhyxxd.supabase.co` |
| Project ref | `axzgcyxszhaqynxhyxxd` |
| Edge Function | `roleplay`、`session-summary`、`character-admin` 已部署，**verify_jwt 開啟**（需登入才能呼叫）|
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
  functions/session-summary/index.ts   ✅ 已部署 —— session → interaction 日記
  functions/character-admin/index.ts   ✅ 已部署 —— 建立/編輯角色（含世界）
  functions/daily-diary|periodic-summary/   ⬜ 還是 stub
  web/src/views/CharacterEditor.tsx    ✅ 角色新增/編輯表單
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
