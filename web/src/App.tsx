import { useEffect, useState } from 'react';
import { isLiveBackend } from './lib/api';
import { supabase } from './lib/supabase';
import { Login } from './Login';
import { CharacterList } from './views/CharacterList';
import { SessionList } from './views/SessionList';
import { ChatView } from './views/ChatView';
import type { CharacterRow, SessionRow } from './lib/db';
import type { Session } from '@supabase/supabase-js';

type View =
  | { name: 'characters' }
  | { name: 'sessions'; character: CharacterRow }
  | { name: 'chat'; character: CharacterRow; session: SessionRow };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isLiveBackend);
  const [view, setView] = useState<View>({ name: 'characters' });

  useEffect(() => {
    if (!isLiveBackend || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setView({ name: 'characters' });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isLiveBackend) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>rp-claude</h1>
          <p className="login-sub">尚未設定 Supabase（複製 web/.env.example 為 web/.env）。</p>
        </div>
      </div>
    );
  }

  if (!authReady) return <div className="login" />;
  if (!session) return <Login />;

  if (view.name === 'characters') {
    return <CharacterList onPick={(character) => setView({ name: 'sessions', character })} />;
  }
  if (view.name === 'sessions') {
    return (
      <SessionList
        character={view.character}
        onBack={() => setView({ name: 'characters' })}
        onOpen={(session) => setView({ name: 'chat', character: view.character, session })}
      />
    );
  }
  return (
    <ChatView
      character={view.character}
      session={view.session}
      onBack={() => setView({ name: 'sessions', character: view.character })}
    />
  );
}
