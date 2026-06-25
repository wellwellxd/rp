import { useEffect, useState } from 'react';
import { listCharacters, type CharacterRow } from '../lib/db';
import { signOut } from '../lib/auth';

export function CharacterList({ onPick }: { onPick: (c: CharacterRow) => void }) {
  const [chars, setChars] = useState<CharacterRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCharacters()
      .then(setChars)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen">
      <header className="appbar">
        <div className="title-block">
          <div className="name">選擇角色</div>
          <div className="sub">每個角色都活在自己的世界裡</div>
        </div>
        <button className="badge" onClick={() => signOut()}>登出</button>
      </header>
      <div className="list">
        {loading && <div className="hint">載入中…</div>}
        {error && <div className="hint err">{error}</div>}
        {!loading && !error && chars.length === 0 && (
          <div className="hint">還沒有角色。</div>
        )}
        {chars.map((c) => (
          <button className="list-item" key={c.id} onClick={() => onPick(c)}>
            <div className="li-title">{c.name}</div>
            {c.occupation && <div className="li-sub">{c.occupation}</div>}
            <div className="li-desc">{c.persona_core}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
