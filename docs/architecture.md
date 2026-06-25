# 系統架構

## 部署拓撲：GitHub Pages + Supabase

```
GitHub Pages（靜態 SPA, web/）
   │  ① anon key + RLS：直接讀自己有權限的資料
   │  ② supabase.functions.invoke()：需要密鑰 / 特權的操作
   ▼
Supabase
   ├─ Auth                使用者登入（前端 SDK）
   ├─ Postgres + pgvector  worlds/characters/life_entries/memory…（RLS 保護）
   ├─ Edge Functions(Deno) roleplay / session-summary / daily-diary / periodic-summary
   │                       └─ 持有 OPENROUTER_API_KEY、service-role key ──► OpenRouter
   └─ Cron(pg_cron+pg_net) 觸發 daily-diary（每日）、periodic-summary（週/月）
```

**鐵則**：GitHub Pages 全部是公開靜態檔。`OPENROUTER_API_KEY` 與 service-role key
**只能**存在 Edge Function secrets，永遠不進前端 bundle。前端只拿 anon key，並倚賴 RLS。

| 需求 | 放哪 |
|------|------|
| 靜態前端 SPA | GitHub Pages（`web/`，GitHub Actions 部署） |
| 登入 | Supabase Auth（前端 SDK，OAuth 轉址設為 Pages URL） |
| DB / 向量檢索 | Supabase Postgres + pgvector |
| 組 prompt、呼叫 OpenRouter、生成日記、彙整 | Supabase Edge Functions |
| 機密金鑰 | Edge Function secrets |
| 排程 | Supabase Cron → 觸發 Edge Functions |

留意：Edge Function 要設 CORS（允許 Pages 來源）、SPA 路由需 hash 或 404 fallback、
Edge Function 執行時間有上限（長文本建議串流）。

## 記憶分層（由穩到動）

```
World Canon       世界根本設定、不可違反限制          （worlds）
   ↓
World State       季節/天氣/城市/近期小事件（可變受控） （world_states）
   ↓
Character Canon   人格、價值觀、語氣、行為邊界          （characters + *_amendments）
   ↓
Life Timeline     所有日記 entry + summary            （life_entries, summaries）
   ↓
Current Session   當下對話現場（非長期記憶層）          （sessions, messages）
   ↓
Session 結束 → 整理成 Diary Entry → 回寫 Life Timeline
```

- **Relationship Thread**（`relationship_threads`）是 Timeline 中使用者相關內容的索引/摘要。
- **Memory Entry**（`memory_entries`）是抽取的長期記憶，append-only，可標 supersedes / interpretation。
- **Embeddings**（`memory_embeddings`）供語意檢索；只由 Edge Function（service-role）查詢，不開放前端。

## 程式碼結構

```
web/                              靜態前端（→ GitHub Pages）
  src/
    main.tsx · App.tsx            骨架頁（後續做聊天 UI / 時間線）
    lib/supabase.ts               anon client（受 RLS）
    lib/api.ts                    functions.invoke 包裝
supabase/
  migrations/
    0001_initial_schema.sql       11 張表 + pgvector + append-only constraint
    0002_rls_policies.sql         RLS（前端安全底線）
  functions/
    _shared/
      cors.ts                     CORS + JSON helper
      supabase.ts                 service-role / user client
      openrouter.ts               統一 LLM 入口 chat()/embed()
      types.ts                    領域型別（對應 schema）
      prompt.ts                   §9 prompt 組合
      guard.ts                    §6/§7.3 主體性守門員 ★
    roleplay/index.ts             §15.1 使用者對話
    session-summary/index.ts      §15.2 session → interaction 日記
    daily-diary/index.ts          §15.3 每日自動日記（Cron）
    periodic-summary/index.ts     §15.4 週/月彙整（Cron）
prompts/autonomous_diary.md       自動日記 prompt 單一事實來源
```

## 三條主要流程

1. **使用者開啟對話（§15.1）**：前端 → `roleplay` function → 載入上下文 + 檢索記憶 → OpenRouter → 存 message。
2. **Session 結束（§15.2）**：`session-summary` → interaction entry → 更新 relationship → 評估記憶/canon candidate → embedding。
3. **每日自動日記（§15.3）**：Cron → `daily-diary` → 生成 → **guard 驗證** → 寫入 Timeline → embedding。

> 原始規劃文件：`~/Downloads/world_aware_character_memory_system.md`（建議複製到 docs/spec.md 納入版控）。
