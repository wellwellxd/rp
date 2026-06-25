// 骨架佔位頁。實際聊天 UI / 角色選擇 / 時間線檢視在後續階段實作（見 docs/plan.md P2+）。
const configured =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '4rem auto',
        padding: '0 1.5rem',
        lineHeight: 1.6,
        color: '#1a1a2e',
      }}
    >
      <h1 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>rp-claude</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        World-aware Character Memory System — 骨架階段
      </p>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '0.9rem 1.1rem',
          borderRadius: 10,
          background: configured ? '#eaf7ef' : '#fdeceb',
          border: `1px solid ${configured ? '#9ad3b1' : '#f0b3ae'}`,
        }}
      >
        {configured ? (
          <span>✓ Supabase 環境變數已設定，可開始接 P2 對話流程。</span>
        ) : (
          <span>⚠ 尚未設定 Supabase 環境變數。複製 <code>web/.env.example</code> 為 <code>web/.env</code> 並填入。</span>
        )}
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#777' }}>
        前端只持有 anon key；所有需要密鑰的操作都透過 Supabase Edge Functions。
        開發計劃見 <code>docs/plan.md</code>。
      </p>
    </main>
  );
}
