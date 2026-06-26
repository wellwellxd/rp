import { useEffect, useState } from 'react';
import {
  listSessions,
  createSession,
  recentLife,
  type CharacterRow,
  type SessionRow,
  type LifeEntryRow,
} from '../lib/db';
import { passADay } from '../lib/api';

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
  const [life, setLife] = useState<LifeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passing, setPassing] = useState(false);
  const [passError, setPassError] = useState('');

  function loadLife() {
    recentLife(character.id).then(setLife).catch(() => {});
  }

  useEffect(() => {
    listSessions(character.id)
      .then(setSessions)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    loadLife();
  }, [character.id]);

  async function newChat() {
    try {
      const s = await createSession(character.id);
      onOpen(s);
    } catch (e) {
      setError(String(e));
    }
  }

  async function passDay() {
    if (passing) return;
    setPassError('');
    setPassing(true);
    try {
      await passADay(character.id);
      loadLife(); // 顯示新生成的日記
    } catch (e) {
      setPassError(String(e instanceof Error ? e.message : e));
    } finally {
      setPassing(false);
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
          <div className="sub">對話與生活</div>
        </div>
      </header>
      <div className="list">
        <button className="new-chat" onClick={newChat}>＋ 開始新對話</button>
        <button className="ghost-btn" onClick={passDay} disabled={passing}>
          {passing ? `${character.name} 正在度過這一天…` : `🌙 讓 ${character.name} 自己過一天`}
        </button>
        {passError && <div className="hint err">{passError}</div>}

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

        {life.length > 0 && (
          <>
            <div className="section-title" style={{ margin: '1.4rem 0 0.6rem' }}>近期生活</div>
            {life.map((e) => (
              <div className="life-entry boxed" key={e.id}>
                <div className="date">{e.entry_date}</div>
                <div className="body">{e.content}</div>
                {(e.emotional_state || e.location) && (
                  <div className="meta">
                    {[e.emotional_state, e.location].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
