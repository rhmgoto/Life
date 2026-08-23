import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    MYLOG_CONFIG?: { supabaseUrl?: string; supabasePublishableKey?: string };
  }
}

let client: SupabaseClient | undefined;

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
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
