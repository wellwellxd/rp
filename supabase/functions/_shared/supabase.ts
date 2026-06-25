import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Edge Function 內的 Supabase client。
 *
 * - serviceClient：用 service-role key，繞過 RLS，做所有特權寫入（日記、記憶、彙整）。
 *   這把 key 只存在 Edge Function 的 secret 裡，絕不外流到前端。
 * - userClient(req)：帶上呼叫者的 JWT，受 RLS 約束，用於「以使用者身分」讀寫。
 *
 * 設定 secrets：
 *   supabase secrets set OPENROUTER_API_KEY=... ALLOWED_ORIGIN=https://<user>.github.io
 * （SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由平台自動注入）
 */
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** 以呼叫者 JWT 建立 client，受 RLS 限制。 */
export function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
}
