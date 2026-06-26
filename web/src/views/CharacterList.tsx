import { useEffect, useState } from 'react';
import { listCharacters, type CharacterRow } from '../lib/db';
import { signOut } from '../lib/auth';

export function CharacterList({
  onPick,
  onCreate,
  onEdit,
}: {
  onPick: (c: CharacterRow) => void;
  onCreate: () => void;
  onEdit: (characterId: string) => void;
}) {
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
        <button className="new-chat" onClick={onCreate}>＋ 新增角色</button>
        {loading && <div className="hint">載入中…</div>}
        {error && <div className="hint err">{error}</div>}
        {!loading && !error && chars.length === 0 && (
          <div className="hint">還沒有角色，建一個吧。</div>
        )}
        {chars.map((c) => (
          <div className="char-row" key={c.id}>
            <button className="char-main" onClick={() => onPick(c)}>
              <div className="li-title">{c.name}</div>
              {c.occupation && <div className="li-sub">{c.occupation}</div>}
              <div className="li-desc">{c.persona_core}</div>
            </button>
            <button className="char-edit icon-btn" aria-label="編輯角色" onClick={() => onEdit(c.id)}>✎</button>
          </div>
        ))}
      </div>
    </div>
  );
}
