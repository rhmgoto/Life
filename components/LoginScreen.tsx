'use client';

import { useState } from 'react';
import type { AppData } from '@/domain/models';
import { downloadBackup } from '@/data/backup';
import { getSupabaseClient } from '@/lib/supabaseClient';

export function LoginScreen({ localData }: { localData: AppData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const signIn = async () => {
    if (!email.trim() || !password) return;
    setSending(true);
    setMessage('');
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
    setSending(false);
    if (error) setMessage(`ログインできませんでした：${error.message}`);
  };

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
      <p className="auth-description">同じメールアドレスとパスワードでログインすると、Windows・iPhone・iPadの記録が自動で同期されます。</p>
      <label>メールアドレス<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" onKeyDown={(event) => event.key === 'Enter' && password && void signIn()} /></label>
      <label>パスワード<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void signIn()} /></label>
      <button className="primary-button auth-submit" disabled={!email.trim() || !password || sending} onClick={() => void signIn()}>{sending ? '確認中…' : 'パスワードでログイン'}</button>
      {message && <p className="auth-message" role="status">{message}</p>}
      <div className="magic-link-fallback"><p>まだパスワードを設定していない場合</p><button disabled={!email.trim() || sending} onClick={() => void sendLink()}>ログイン用メールを送る</button></div>
      <div className="local-backup-note"><p>この端末に以前の記録がある場合は、必要に応じてバックアップを書き出せます。</p><button onClick={() => downloadBackup(localData)}>バックアップを書き出す</button></div>
    </section>
  </main>;
}
