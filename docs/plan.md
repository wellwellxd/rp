# 開發計劃 — World-aware Character Memory System

本計劃把規劃文件拆成可逐步交付的階段。每個階段都能獨立驗收，後一階段依賴前一階段。
技術棧：**靜態前端（Vite/React）→ GitHub Pages** ＋ **Supabase（Auth + Postgres + pgvector + Edge Functions + Cron）** ＋ **OpenRouter（統一 LLM）**。

> 部署鐵則：GitHub Pages 全是公開靜態檔。所有需要密鑰的後端邏輯都在 **Supabase Edge Functions**，
> `OPENROUTER_API_KEY` / service-role key 只放 Edge Function secrets，**永不進前端**。前端只拿 anon key + RLS。
> 架構圖見 [architecture.md](architecture.md)。

> 核心戒律（貫穿所有階段）
> 1. **使用者主體性**：系統不得替使用者創造行為、訊息、回覆、承諾或共同事件。
> 2. **Append-only**：記憶 / canon / world 只續寫不改寫。
> 3. **保守生活感**：自動日記低戲劇性、延續記憶、不推進重大劇情。

---

## 階段總覽

| 階段 | 主題 | 產出 | MVP? |
|------|------|------|------|
| P0 | 專案基礎建設 | 工具鏈、Supabase 連線、DB schema、OpenRouter client | ✅ |
| P1 | Canon 編輯 | World / Character CRUD、Canon Amendment（append-only） | ✅ |
| P2 | 對話 Session | session/messages、prompt 組合、roleplay 回覆 | ✅ |
| P3 | Session → 日記 | interaction life entry、更新 relationship thread | ✅ |
| P4 | 自動日記 | 每日保守日記 + guard 守門員 + cron | ✅ |
| P5 | 記憶與檢索 | append-only memory entries、pgvector 檢索 | ✅ |
| P6 | 彙整機制 | daily / weekly / monthly summary、canon candidate | 部分 |
| P7 | 產品化 / 進階 | 前端、NPC、審核工作流、多租戶 | ❌ post-MVP |

---

## P0 — 專案基礎建設

**目標**：前端能 build/部署到 Pages、Supabase 連得上、Edge Function 能發出一次 OpenRouter 呼叫。

- [ ] 建立 Supabase 專案；`supabase init`，套用 `0001` + `0002` migration（`supabase db push`）
- [ ] 啟用 `vector` extension，確認 embedding 維度與 schema 的 `vector(1536)` 一致
- [ ] 設定 Edge Function secrets：`OPENROUTER_API_KEY`、`ALLOWED_ORIGIN`（Pages URL）
- [ ] 實作 `functions/_shared/openrouter.ts` 的 `chat()` / `embed()`，部署 `roleplay` 做冒煙測試
- [ ] `cd web && npm i && cp .env.example .env`（填 anon key），`npm run build` 通過
- [ ] 在 repo Settings 開啟 Pages（GitHub Actions 來源），設好 `VITE_*` repo variables；push 觸發部署
- [ ] 用 `supabase gen types typescript` 產生 DB 型別，接進 client

**驗收**：Pages 顯示「環境變數已設定」綠燈；呼叫 `roleplay` function 能成功打到模型一次。

---

## P1 — Canon 編輯（World + Character）

**目標**：能定義一個世界與一個住在其中的角色，且 canon 可續寫不改寫。

- [ ] worlds / world_states CRUD（含 forbidden_events 欄位）
- [ ] characters CRUD（persona_core、voice_style、relationship_rules…）
- [ ] `character_canon_amendments` / `world_amendments`：只能 append，附 reason 與 source_entry_ids
- [ ] 一個 helper：載入「角色當前完整 canon」= 原始 canon + 依 valid_from/priority 疊加的 amendments

**驗收**：給一筆 amendment，讀取時原始設定與後續規則都保留（§12.3 範例可重現）。

---

## P2 — 對話 Session（roleplay 主線）

**目標**：使用者開啟對話，角色以「剛從自己生活轉過來」的姿態回覆。

- [ ] session 生命週期：建立 / 延續 / 結束（sessions、session_status）
- [ ] messages 儲存（role、content、token_count）
- [ ] `composeRoleplaySystemPrompt`：依 §9 順序載入 World→State→Canon→Amendments→Recent Timeline→Relationship→Retrieved Memory
- [ ] roleplay 回覆守則：角色有自己的生活、不假裝今天互動過、不替使用者創造行為
- [ ] 呼叫 OpenRouter 產生回覆並存 message

**驗收**：對「今天過得怎麼樣？」角色能自然帶出近期生活（對齊 §18.1）。
依賴：P1（canon）。P5 的檢索可先以「最近 N 筆」佔位，之後再換語意檢索。

---

## P3 — Session 結束 → interaction 日記

**目標**：對話結束後整理成日記，而不是只留聊天紀錄。

- [x] `session-summary` function：摘要 session → 產生 interaction life entry（日期 = 角色內在曆法 `session_date`）
- [x] 標記 `source_type = interaction`、`user_presence_level = interaction`、`user_agency_created = true`（唯一正當設 true 的路徑）
- [x] 更新 `relationship_threads`（shared_memory_summary、unresolved_threads；stage/trust 待補）
- [x] 角色內在曆法：`characters.initial_date` + `sessions.session_date`（新 session = 下一天，trigger 自動推進）
- [ ] 評估是否升級為 memory entry / canon candidate（接 P5/P6）

**驗收**：一段真實對話結束後，Timeline 出現一篇 interaction entry，relationship thread 被更新（對齊 §18.3）。
依賴：P2。

---

## P4 — 每日自動日記（含 guard 守門員）⭐

**目標**：沒有使用者時，角色仍有合理、保守、低戲劇性的生活紀錄。本階段是體驗成敗關鍵。

- [ ] `composeDiarySystemPrompt`：載入 `prompts/autonomous_diary.md` + 上下文 + 低敏感關係摘要
- [ ] `generateAutonomousDiary`：產生 → 解析 JSON → 驗證 → 寫入 → embedding
- [ ] **guard `validateAutonomousEntry`（核心安全層，§6/§7.3）**：
      - user_agency_created 必為 false；user_presence_level 不得為 forbidden_fabrication
      - drama_level 應為 low；攔截禁止事件（死亡/告白/搬家/離職/偶遇使用者…）
      - 攔截「使用者新行為 / 新回覆 / 共同事件」
- [ ] 事件預算控制（§7.4：每日 0–2 普通事件、0 重大事件）
- [ ] `functions/daily-diary` + Supabase Cron（pg_cron + pg_net）每日觸發

**驗收**：連跑數日，日記連續、保守、引用既有記憶；guard 能擋下被注入的違規內容（對齊 §18.2）。
依賴：P1、P5（檢索）。

---

## P5 — 記憶與語意檢索（Append-only Memory）

**目標**：角色記得重要事，且記憶只續寫不改寫。

- [ ] `appendMemory`：永遠 insert；新理解設 `supersedes_memory_id`，新解釋設 `interpretation_of_memory_id`
- [ ] embedding 寫入 `memory_embeddings`（life_entry / memory_entry / summary 皆可）
- [ ] Postgres RPC `match_memory_embeddings`（cosine），`retrieveRelevantMemories` 取回
- [ ] 檢索時同時回傳被續寫的原始記憶，保留成長層次（§12.6）

**驗收**：「角色不喜歡人群」+ 後續續寫，檢索後兩者皆在，模型不會誤判舊人格消失（對齊 §18.4）。
依賴：P0（pgvector）。可與 P2 並行，先用佔位檢索。

---

## P6 — 彙整機制（Daily / Weekly / Monthly）

**目標**：形成角色生活篇章，並有節制地產生人格 / 世界演化候選。

- [ ] daily summary：彙整當日 entries + state
- [ ] weekly summary：反覆情緒、生活節奏、關係變化、人格演化候選（每週最多 1 輕微變化）
- [ ] monthly summary：人生主題、價值觀基調、canon amendment candidate（每月最多 1 中等變化；重大需審核）
- [ ] `functions/periodic-summary` + Cron（週 / 月各一條）
- [ ] candidate 一律走 append（新增 amendment），不改寫舊 canon

**驗收**：跑滿一週/一月能產出有主題的 summary，且任何「變化」都以新增呈現。
依賴：P3、P4、P5。

---

## P7 — 產品化 / 進階（post-MVP，先不做）

- 前端（Web / Mobile / Discord-Telegram Bot）與 Supabase Auth + RLS 串接
- 複雜 NPC 系統、多角色世界模擬
- canon candidate 的人工審核工作流
- 多人共用同一角色世界、多裝置同步
- 大型事件推進（需設計不可逆事件的審核閘門）

---

## MVP 範圍與成功標準對照

MVP = **P0–P5 + P6 的 daily/weekly**。對照規劃文件 §17：

| 成功標準 | 由哪個階段保證 |
|----------|----------------|
| 角色非空白啟動，剛從生活轉過來 | P2 + P4 |
| 互動時能自然提起近期生活 | P2 |
| 不擅自創造使用者沒參與的共同事件 | **P4 guard** |
| 無使用者時仍有保守生活紀錄 | P4 |
| 記得重要互動但不被短期對話污染 | P3 + P5 |
| 世界設定穩定約束日記 | P1 + P4 |
| 週/月 summary 形成生活篇章 | P6 |
| 長期記憶只續寫不改寫 | P5 + DB constraint |
| 人格演化像成長而非覆蓋 | P1 amendments + P6 |

---

## 建議實作順序

```
P0 → P1 → P2 → P3
            ↘ P5（與 P2/P3 並行，先佔位後接語意檢索）
P4（依賴 P1+P5）→ P6
```

先打通「P0→P1→P2→P3」這條 happy path（使用者能對話、結束後成日記），
再補 P5 檢索與 P4 自動日記，最後 P6 彙整。P7 等 MVP 驗證後再開。
