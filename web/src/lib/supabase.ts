import { createClient } from '@supabase/supabase-js';

// 前端只用 anon key，所有資料存取受 RLS 約束（見 supabase/migrations/0002_rls_policies.sql）。
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // 在 build / 執行階段早點失敗，避免拿到空 client。
  console.warn('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (see web/.env.example)');
}

export const supabase = createClient(url ?? '', anonKey ?? '');
