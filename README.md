# rp-claude — World-aware Character Memory System

一個「不是只在使用者開啟對話時才存在」的角色扮演型 AI。角色生活在特定世界觀中，
有自己的背景、人格、生活節奏與長期記憶；使用者互動是角色生活的一部分，而不是全部。

核心原則：
- **使用者主體性**：系統不替使用者創造行為、訊息、承諾或共同事件。
- **Append-only memory**：記憶 / 人格 / 世界只續寫不改寫，人格是「成長」而非「覆蓋」。
- **保守生活感**：無使用者時自動生成低戲劇性、延續記憶的日記。

## 架構：GitHub Pages + Supabase

```
GitHub Pages（靜態前端 web/）
   │ anon key + RLS（讀）／ functions.invoke（需密鑰的操作）
   ▼
Supabase ── Edge Functions(Deno, 持有 OpenRouter 密鑰) ──► OpenRouter
         ├─ Postgres + pgvector（記憶 / 檢索）
         ├─ Auth（登入）
         └─ Cron（每日日記 / 週月彙整）
```

> **鐵則**：GitHub Pages 是公開靜態檔，`OPENROUTER_API_KEY` 與 service-role key 只放 Edge Function
> secrets，永不進前端。前端只持有 anon key 並倚賴 RLS。

## 文件

- 開發計劃與階段拆分 → [docs/plan.md](docs/plan.md)
- 系統架構與部署拓撲 → [docs/architecture.md](docs/architecture.md)
- 自動日記 prompt → [prompts/autonomous_diary.md](prompts/autonomous_diary.md)
- DB schema / RLS → [supabase/migrations/](supabase/migrations/)

## 開始

```bash
# 1) Supabase
supabase init
supabase db push                       # 套用 0001 schema + 0002 RLS
supabase functions deploy              # 部署 Edge Functions
supabase secrets set OPENROUTER_API_KEY=... ALLOWED_ORIGIN=https://<user>.github.io

# 2) 前端（本地）
cd web
npm install
cp .env.example .env                   # 填入 VITE_SUPABASE_URL / ANON_KEY
npm run dev

# 3) 部署前端：push 到 main，GitHub Actions 自動 build & deploy 到 Pages
#    （先在 repo Settings → Pages 選 GitHub Actions，並設好 VITE_* repo variables）
```

## 目前狀態

**可運作**：登入 → 選角色 → 對話（真 LLM）→ 對話存進 DB、可回看每段 session。
後端在 Supabase（Auth + Postgres + Edge Function `roleplay`），LLM 走 OpenRouter。

👉 **接手 / 開新 session 請先讀 [docs/STATUS.md](docs/STATUS.md)** —— 完整現況、雲端資源、如何跑/部署、下一步候選。
分階段計劃見 [docs/plan.md](docs/plan.md)。
