-- =============================================================
-- 每角色可指定 LLM 模型（OpenRouter model id）。
-- null = 沿用 Edge Function 的環境預設（MODEL_ROLEPLAY / MODEL_SUMMARY）。
-- 對話與寫日記都會用該角色的模型，保持口吻一致。
-- =============================================================
alter table characters
  add column if not exists model text;
