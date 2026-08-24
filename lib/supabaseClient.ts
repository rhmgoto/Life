import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    MYLOG_CONFIG?: { supabaseUrl?: string; supabasePublishableKey?: string };
  }
}

let client: SupabaseClient | undefined;
const STORAGE_KEY = 'mylog-auth-session';

export function getSupabaseConfig() {
  if (typeof window === 'undefined') return { url: '', key: '' };
  return {
    url: window.MYLOG_CONFIG?.supabaseUrl?.trim() ?? '',
    key: window.MYLOG_CONFIG?.supabasePublishableKey?.trim() ?? '',
  };
}

export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.key);
}

export function getSupabaseClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config.url || !config.key) throw new Error('Supabaseが設定されていません。');
  client ??= createClient(config.url, config.key, {
    auth: {
      storageKey: STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return client;
}

export async function restoreSupabaseSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const url = new URL(window.location.href);
  const hasAuthCode = url.searchParams.has('code');

  if (hasAuthCode) {
    const { error } = await client.auth.exchangeCodeForSession(url.searchParams.get('code') ?? '');
    url.searchParams.delete('code');
    window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
    if (error) {
      console.warn('Supabase session exchange failed:', error.message);
    }
  }

  const { data } = await client.auth.getSession();
  return data.session;
}
