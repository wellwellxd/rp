import { useEffect, useRef, useState } from 'react';
import {
  loadMessages,
  loadSessionDiary,
  recentLife,
  getWorld,
  type CharacterRow,
  type SessionRow,
  type DiaryEntryRow,
  type LifeEntryRow,
  type WorldRow,
} from '../lib/db';
import { sendMessage, endSession, type ChatTurn } from '../lib/api';
import { Markdown } from '../components/Markdown';

function fmtDate(d: string | null | undefined) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ChatView({
  character,
  session,
  onBack,
}: {
  character: CharacterRow;
  session: SessionRow;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [life, setLife] = useState<LifeEntryRow[]>([]);
  const [world, setWorld] = useState<WorldRow | null>(null);
  const [summarized, setSummarized] = useState(session.session_status === 'summarized');
  const [diary, setDiary] = useState<DiaryEntryRow | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const readOnly = summarized;

  useEffect(() => {
    loadMessages(session.id).then((rows) =>
      setMessages(
        rows
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ),
    );
    recentLife(character.id).then(setLife).catch(() => {});
    getWorld(character.world_id).then(setWorld).catch(() => {});
    if (session.session_status === 'summarized') {
      loadSessionDiary(session.id).then(setDiary).catch(() => {});
    }
  }, [session.id, session.session_status, character.id, character.world_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending, diary]);

  async function handleSend() {
    const text = input.trim();
    if (!text || pending || readOnly) return;
    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages(history);
    setInput('');
    setPending(true);
    try {
      const { reply } = await sendMessage({
        characterId: character.id,
        sessionId: session.id,
        message: text,
        history,
      });
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: `（發生錯誤：${String(err)}）` }]);
    } finally {
      setPending(false);
    }
  }

  async function handleSummarize() {
    if (summarizing || messages.length === 0) return;
    setError('');
    setSummarizing(true);
    try {
      const entry = await endSession(session.id);
      setDiary(entry);
      setSummarized(true);
    } catch (err) {
      setError(`整理失敗：${String(err)}`);
    } finally {
      setSummarizing(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="screen">
      <header className="appbar">
        <button className="icon-btn" aria-label="返回" onClick={onBack}>‹</button>
        <div className="title-block">
          <div className="name">{character.name}</div>
          <div className="sub">
            {[world?.name, fmtDate(session.session_date)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button className="icon-btn" aria-label="角色資訊" onClick={() => setDrawerOpen(true)}>☰</button>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-hint">
            和 {character.name} 開始這段對話吧。
          </div>
        )}
        {messages.map((m, i) => (
          <div className={`msg ${m.role}`} key={i}>
            <div className="bubble">
              <div className="who">{m.role === 'user' ? '你' : character.name}</div>
              <Markdown>{m.content}</Markdown>
            </div>
          </div>
        ))}
        {pending && <div className="typing">{character.name} 正在回覆…</div>}

        {readOnly && (
          <div className="diary-card">
            <div className="diary-head">
              {character.name} 的日記 · {fmtDate(diary?.entry_date ?? session.session_date)}
            </div>
            {diary ? (
              <>
                {diary.title && <div className="diary-title">{diary.title}</div>}
                <div className="diary-body"><Markdown>{diary.content}</Markdown></div>
                {(diary.emotional_state || diary.location) && (
                  <div className="diary-meta">
                    {[diary.emotional_state, diary.location].filter(Boolean).join(' · ')}
                  </div>
                )}
              </>
            ) : (
              <div className="diary-body">（這段對話已整理成日記。）</div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {readOnly ? (
        <div className="composer locked">
          <span className="locked-note">這段對話已整理成日記，無法再回覆。</span>
        </div>
      ) : (
        <>
          {messages.length > 0 && (
            <div className="session-actions">
              {error && <span className="hint err">{error}</span>}
              <button className="summarize-btn" onClick={handleSummarize} disabled={summarizing || pending}>
                {summarizing ? '整理中…' : '結束對話並整理成日記'}
              </button>
            </div>
          )}
          <div className="composer">
            <textarea
              rows={1}
              value={input}
              placeholder="說點什麼…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button onClick={handleSend} disabled={pending || !input.trim()}>送出</button>
          </div>
        </>
      )}

      <div className={`scrim${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer${drawerOpen ? ' open' : ''}`}>
        <button className="drawer-close" aria-label="關閉" onClick={() => setDrawerOpen(false)}>✕</button>
        <h1>{character.name}</h1>
        {character.occupation && <p className="role">{character.occupation}</p>}

        {world && (
          <>
            <div className="section-title">所在世界 · {world.name}</div>
            <p className="canon">{world.world_canon}</p>
          </>
        )}

        <div className="section-title">人格</div>
        <p className="canon">{character.persona_core}</p>

        <div className="section-title">對話模型</div>
        <p className="canon">{character.model || '預設（Claude Sonnet 4.6）'}</p>

        <div className="section-title">近期生活</div>
        {life.length === 0 && <p className="canon">（尚無記錄）</p>}
        {life.map((e) => (
          <div className="life-entry" key={e.id}>
            <div className="date">{e.entry_date}</div>
            <div className="body">{e.content}</div>
            {(e.emotional_state || e.location) && (
              <div className="meta">
                {[e.emotional_state, e.location].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ))}
      </aside>
    </div>
  );
}
