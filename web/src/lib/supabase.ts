import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 前端只用 anon key，所有資料存取受 RLS 約束（見 supabase/migrations/0002_rls_policies.sql）。
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

// 未設定時保持 null —— 用空字串呼叫 createClient 會直接 throw（"supabaseUrl is required"），
// 那會在 demo 模式下讓整頁白屏。需要時再由 api.ts 在 isConfigured 為真時使用。
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, anonKey!)
  : null;

if (!isConfigured) {
  console.info('[rp-claude] Supabase 未設定，使用 demo 模式（本機 mock 回覆）。');
}
