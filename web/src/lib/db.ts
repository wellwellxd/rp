import { supabase } from './supabase';

// 前端的 DB 存取層。讀取受 RLS 約束（characters / 自主 life_entries 可讀、
// sessions/messages 僅限本人）。messages 的「寫入」走 Edge Function（service-role），
// 因為 RLS 只開放前端讀自己的訊息、不開放直接寫。

export interface CharacterRow {
  id: string;
  world_id: string;
  name: string;
  persona_core: string;
  occupation: string | null;
  voice_style: string | null;
}

export interface WorldRow {
  id: string;
  name: string;
  world_canon: string;
}

export interface SessionRow {
  id: string;
  character_id: string;
  started_at: string;
  ended_at: string | null;
  session_status: string;
  session_date: string | null; // 角色生命中的「這一天」（內在曆法，與真實時間脫鉤）
}

export interface MessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface LifeEntryRow {
  id: string;
  entry_date: string;
  content: string;
  emotional_state: string | null;
  location: string | null;
}

function db() {
  if (!supabase) throw new Error('Supabase 未設定');
  return supabase;
}

export async function listCharacters(): Promise<CharacterRow[]> {
  const { data, error } = await db()
    .from('characters')
    .select('id, world_id, name, persona_core, occupation, voice_style')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getWorld(worldId: string): Promise<WorldRow | null> {
  const { data, error } = await db()
    .from('worlds')
    .select('id, name, world_canon')
    .eq('id', worldId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSessions(characterId: string): Promise<SessionRow[]> {
  const { data, error } = await db()
    .from('sessions')
    .select('id, character_id, started_at, ended_at, session_status, session_date')
    .eq('character_id', characterId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSession(characterId: string): Promise<SessionRow> {
  const { data: userData } = await db().auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('未登入');
  const { data, error } = await db()
    .from('sessions')
    .insert({ character_id: characterId, user_id: userId })
    .select('id, character_id, started_at, ended_at, session_status, session_date')
    .single();
  if (error) throw error;
  return data;
}

export async function loadMessages(sessionId: string): Promise<MessageRow[]> {
  const { data, error } = await db()
    .from('messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export interface DiaryEntryRow {
  id: string;
  entry_date: string;
  title: string | null;
  content: string;
  emotional_state: string | null;
  location: string | null;
}

// 讀取某段 session 整理出的日記（interaction life entry）。
export async function loadSessionDiary(sessionId: string): Promise<DiaryEntryRow | null> {
  const { data, error } = await db()
    .from('life_entries')
    .select('id, entry_date, title, content, emotional_state, location')
    .eq('related_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function recentLife(characterId: string): Promise<LifeEntryRow[]> {
  const { data, error } = await db()
    .from('life_entries')
    .select('id, entry_date, content, emotional_state, location')
    .eq('character_id', characterId)
    .order('entry_date', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data ?? [];
}
