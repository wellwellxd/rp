import { supabase } from './supabase';

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase 未設定');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
