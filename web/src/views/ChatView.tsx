import { useEffect, useRef, useState } from 'react';
import {
  loadMessages,
  recentLife,
  getWorld,
  type CharacterRow,
  type LifeEntryRow,
  type WorldRow,
} from '../lib/db';
import { sendMessage, type ChatTurn } from '../lib/api';

export function ChatView({
  character,
  sessionId,
  onBack,
}: {
  character: CharacterRow;
  sessionId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [life, setLife] = useState<LifeEntryRow[]>([]);
  const [world, setWorld] = useState<WorldRow | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages(sessionId).then((rows) =>
      setMessages(
        rows
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ),
    );
    recentLife(character.id).then(setLife).catch(() => {});
    getWorld(character.world_id).then(setWorld).catch(() => {});
  }, [sessionId, character.id, character.world_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || pending) return;
    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages(history);
    setInput('');
    setPending(true);
    try {
      const { reply } = await sendMessage({
        characterId: character.id,
        sessionId,
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
          {world && <div className="sub">{world.name}</div>}
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
              {m.content}
            </div>
          </div>
        ))}
        {pending && <div className="typing">{character.name} 正在回覆…</div>}
        <div ref={endRef} />
      </div>

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
