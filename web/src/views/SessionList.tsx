import { useEffect, useState } from 'react';
import { listSessions, createSession, type CharacterRow, type SessionRow } from '../lib/db';

export function SessionList({
  character,
  onBack,
  onOpen,
}: {
  character: CharacterRow;
  onBack: () => void;
  onOpen: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listSessions(character.id)
      .then(setSessions)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [character.id]);

  async function newChat() {
    try {
      const s = await createSession(character.id);
      onOpen(s.id);
    } catch (e) {
      setError(String(e));
    }
  }

  function fmt(ts: string) {
    return new Date(ts).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="screen">
      <header className="appbar">
        <button className="icon-btn" aria-label="返回" onClick={onBack}>‹</button>
        <div className="title-block">
          <div className="name">{character.name}</div>
          <div className="sub">對話紀錄</div>
        </div>
      </header>
      <div className="list">
        <button className="new-chat" onClick={newChat}>＋ 開始新對話</button>
        {loading && <div className="hint">載入中…</div>}
        {error && <div className="hint err">{error}</div>}
        {!loading && !error && sessions.length === 0 && (
          <div className="hint">還沒有對話紀錄，開一段新的吧。</div>
        )}
        {sessions.map((s) => (
          <button className="list-item" key={s.id} onClick={() => onOpen(s.id)}>
            <div className="li-title">對話 · {fmt(s.started_at)}</div>
            <div className="li-sub">{s.session_status === 'active' ? '進行中' : s.session_status}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
