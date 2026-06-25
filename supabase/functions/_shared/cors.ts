// CORS：Edge Function 必須允許 GitHub Pages 網域呼叫。
// 設定 ALLOWED_ORIGIN 為你的 Pages URL（例：https://<user>.github.io）。
// 本地開發時可暫用 "*"，正式環境務必鎖定來源。
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** 處理 preflight。在每個 function 入口最前面呼叫。 */
export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
