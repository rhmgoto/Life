'use client';

import { useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { downloadBackup, readBackup } from '@/data/backup';
import type { LogRepository } from '@/data/logRepository';
import type { AppData } from '@/domain/models';

interface Props {
  data: AppData;
  repository: LogRepository;
  user: User | null;
  configured: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function DataSettings({ data, repository, user, configured, onClose, onImported, onSignOut }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await readBackup(file);
      await repository.importData(imported);
      await onImported();
      setMessage(`復元しました（記録 ${imported.logs.length}件、予定 ${imported.events.length}件）`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '復元できませんでした。');
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="editor compact data-settings" role="dialog" aria-modal="true" aria-labelledby="data-settings-title">
      <header><div><p className="eyebrow">DATA & SYNC</p><h2 id="data-settings-title">保存と同期</h2></div><button className="icon-button" onClick={onClose} aria-label="閉じる">×</button></header>
      <div className={`account-state ${user ? 'connected' : ''}`}>
        <strong>{user ? 'クラウド同期を使用中' : configured ? 'ログインしていません' : 'この端末だけに保存中'}</strong>
        <p>{user?.email ?? (configured ? 'ログインすると他の端末と同期できます。' : 'Supabaseを設定すると自動同期を始められます。')}</p>
      </div>
      <section className="settings-section">
        <h3>バックアップ</h3>
        <p>記録と予定をJSONファイルとして保存できます。定期的な書き出しをおすすめします。</p>
        <div className="settings-actions">
          <button className="primary-button" onClick={() => downloadBackup(data)}>バックアップを書き出す</button>
          <button className="ghost-button" onClick={() => inputRef.current?.click()}>バックアップから復元</button>
          <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
        </div>
      </section>
      {!configured && <section className="settings-section setup-hint"><h3>クラウド同期の準備</h3><p><code>public/config.js</code>にSupabaseのProject URLとPublishable keyを設定するとログインが有効になります。</p></section>}
      {message && <p className="settings-message" role="status">{message}</p>}
      {user && <button className="danger-button signout-button" onClick={() => void onSignOut()}>ログアウト</button>}
    </section>
  </div>;
}
