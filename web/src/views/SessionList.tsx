import { useEffect, useState } from 'react';
import { listSessions, createSession, type CharacterRow, type SessionRow } from '../lib/db';

export function SessionList({
  character,
  onBack,
  onOpen,
}: {
  character: CharacterRow;
  onBack: () => void;
  onOpen: (session: SessionRow) => void;
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
      onOpen(s);
    } catch (e) {
      setError(String(e));
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function statusLabel(s: SessionRow) {
    if (s.session_status === 'summarized') return '已整理成日記';
    if (s.session_status === 'ended') return '已結束';
    return '進行中';
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
          <button className="list-item" key={s.id} onClick={() => onOpen(s)}>
            <div className="li-title">{s.session_date ? fmtDate(s.session_date) : '對話'}</div>
            <div className="li-sub">{statusLabel(s)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
