'use client';

import { useState } from 'react';
import type { AppData } from '@/domain/models';
import { downloadBackup } from '@/data/backup';
import { getSupabaseClient } from '@/lib/supabaseClient';

export function LoginScreen({ localData }: { localData: AppData }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendLink = async () => {
    if (!email.trim()) return;
    setSending(true);
    setMessage('');
    const redirect = new URL(window.location.href);
    redirect.search = '';
    redirect.hash = '';
    const { error } = await getSupabaseClient().auth.signInWithOtp({
      email: email.trim(), options: { emailRedirectTo: redirect.href },
    });
    setSending(false);
    setMessage(error ? `送信できませんでした：${error.message}` : 'ログイン用メールを送りました。メール内のリンクを開いてください。');
  };

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand auth-brand"><span className="brand-mark">M</span><span>MyLog</span></div>
      <p className="eyebrow">PRIVATE JOURNAL</p>
      <h1>記録をひらく</h1>
      <p className="auth-description">同じメールアドレスでログインすると、Windows・iPhone・iPadの記録が自動で同期されます。</p>
      <label>メールアドレス<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" onKeyDown={(event) => event.key === 'Enter' && void sendLink()} /></label>
      <button className="primary-button auth-submit" disabled={!email.trim() || sending} onClick={() => void sendLink()}>{sending ? '送信中…' : 'ログイン用メールを送る'}</button>
      {message && <p className="auth-message" role="status">{message}</p>}
      <div className="local-backup-note"><p>この端末に以前の記録がある場合、初回ログイン時にクラウドへ引き継ぎます。</p><button onClick={() => downloadBackup(localData)}>先にバックアップを書き出す</button></div>
    </section>
  </main>;
}
