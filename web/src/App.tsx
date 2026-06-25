import { useState, useRef, useEffect } from 'react';
import { character, world, recentEntries } from './lib/fixtures';
import { sendMessage, isLiveBackend } from './lib/api';
import type { ChatTurn } from './lib/mockBackend';

export function App() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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
        characterId: character.name,
        message: text,
        history,
      });
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages([
        ...history,
        { role: 'assistant', content: `（發生錯誤：${String(err)}）` },
      ]);
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
    <div className="app">
      <aside className="sidebar">
        <h1>{character.name}</h1>
        <p className="role">{character.occupation}</p>

        <div className="section-title">所在世界 · {world.name}</div>
        <span className="world-chip">{world.season}</span>
        <span className="world-chip">{world.weather}</span>
        <p className="canon">{world.canon}</p>

        <div className="section-title">人格</div>
        <p className="canon">{character.personaCore}</p>

        <div className="section-title">近期生活</div>
        {recentEntries.map((e, i) => (
          <div className="life-entry" key={i}>
            <div className="date">{e.date}</div>
            <div className="body">{e.content}</div>
            <div className="meta">
              {e.emotionalState} · {e.location}
            </div>
          </div>
        ))}
      </aside>

      <main className="chat">
        <header className="chat-header">
          <span className="title">與 {character.name} 對話</span>
          {isLiveBackend ? (
            <span className="badge live">已接後端</span>
          ) : (
            <span className="badge">Demo 模式 · 本機示意回覆</span>
          )}
        </header>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-hint">
              試著問問「今天過得怎麼樣？」
              <br />
              {character.name} 會從自己的近期生活聊起。
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
            placeholder="說點什麼…（Enter 送出、Shift+Enter 換行）"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button onClick={handleSend} disabled={pending || !input.trim()}>
            送出
          </button>
        </div>
      </main>
    </div>
  );
}
