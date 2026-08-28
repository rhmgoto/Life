'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { downloadBackup, readBackup } from '@/data/backup';
import { chooseLocalFileBackupFolder, getLocalFileBackupStatus, type LocalFileBackupStatus, writeLocalFileBackupNow } from '@/data/fileBackup';
import type { RecoverySnapshot } from '@/data/indexedDbRepository';
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
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [fileBackupStatus, setFileBackupStatus] = useState<LocalFileBackupStatus>({ available: false, connected: false });
  const [fileBackupBusy, setFileBackupBusy] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setSnapshots(await repository.getRecoverySnapshots());
  }, [repository]);

  useEffect(() => {
    let active = true;
    void Promise.all([repository.getRecoverySnapshots(), getLocalFileBackupStatus()]).then(([items, status]) => {
      if (active) {
        setSnapshots(items);
        setFileBackupStatus(status);
      }
    });
    return () => { active = false; };
  }, [repository]);

  const connectFileBackup = async () => {
    try {
      setFileBackupBusy(true);
      const status = await chooseLocalFileBackupFolder(data);
      setFileBackupStatus(status);
      setMessage(status.folderName ? `${status.folderName} に自動保存を設定しました。` : '自動保存を設定しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '自動保存を設定できませんでした。');
    } finally {
      setFileBackupBusy(false);
    }
  };

  const writeFileBackup = async () => {
    try {
      setFileBackupBusy(true);
      const fileName = await writeLocalFileBackupNow(data);
      setFileBackupStatus(await getLocalFileBackupStatus());
      setMessage(`${fileName} を保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存できませんでした。');
    } finally {
      setFileBackupBusy(false);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await readBackup(file);
      await repository.importData(imported);
      await onImported();
      setMessage(`復元しました（記録 ${imported.logs.length}件）`);
      await loadSnapshots();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '復元できませんでした。');
    }
  };

  const restoreSnapshot = async (snapshot: RecoverySnapshot) => {
    const label = new Date(snapshot.createdAt).toLocaleString('ja-JP');
    if (!window.confirm(`${label} の状態に戻します。\n現在の状態も復旧用に保存してから戻します。`)) return;
    try {
      setRestoringId(snapshot.id);
      const restored = await repository.restoreRecoverySnapshot(snapshot.id);
      await onImported();
      await loadSnapshots();
      setMessage(`スナップショットから復元しました（記録 ${restored.logs.length}件）`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '復元できませんでした。');
    } finally {
      setRestoringId(null);
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="editor compact data-settings" role="dialog" aria-modal="true" aria-labelledby="data-settings-title">
      <header><div><p className="eyebrow">DATA & SYNC</p><h2 id="data-settings-title">保存と同期</h2></div><button className="icon-button" onClick={onClose} aria-label="閉じる">×</button></header>
      <section className="settings-section">
        <h3>保存状態</h3>
        <div className="status-list">
          <div className={`status-row ${user ? 'connected' : ''}`}>
            <span>クラウド同期</span>
            <strong>{user ? '使用中' : configured ? '未ログイン' : '未設定'}</strong>
            <small>{user?.email ?? (configured ? 'ログインすると複数端末で同期できます。' : 'Supabaseを設定すると使えます。')}</small>
          </div>
          <div className={`status-row ${fileBackupStatus.connected ? 'connected' : ''}`}>
            <span>PCフォルダ自動保存</span>
            <strong>{fileBackupStatus.connected ? '設定済み' : '未設定'}</strong>
            <small>{fileBackupStatus.available ? fileBackupStatus.connected ? `${fileBackupStatus.folderName ?? '選択したフォルダ'} に1日1回JSON保存します。` : '保存先フォルダを一度選ぶと、Windows PC上に自動保存できます。' : 'このブラウザでは使えません。ChromeまたはEdgeで使えます。'}</small>
          </div>
        </div>
        {fileBackupStatus.lastBackupAt && <p className="file-backup-note">最終保存: {new Date(fileBackupStatus.lastBackupAt).toLocaleString('ja-JP')}</p>}
        {fileBackupStatus.available && <div className="settings-actions">
          <button className="primary-button" disabled={fileBackupBusy} onClick={() => void connectFileBackup()}>{fileBackupStatus.connected ? '保存先フォルダを変更' : '保存先フォルダを選ぶ'}</button>
          <button className="ghost-button" disabled={fileBackupBusy || !fileBackupStatus.folderName} onClick={() => void writeFileBackup()}>今すぐPCに保存</button>
        </div>}
      </section>
      <section className="settings-section">
        <h3>復元</h3>
        <div className="restore-block">
          <h4>PCフォルダのバックアップから復元</h4>
          <p>PCに保存されたMyLogのJSONファイルから記録を戻します。</p>
          <div className="settings-actions">
            <button className="primary-button" onClick={() => inputRef.current?.click()}>JSONファイルを選ぶ</button>
            <button className="ghost-button" onClick={() => downloadBackup(data)}>現在の状態を書き出す</button>
            <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
          </div>
        </div>
        <div className="restore-block">
          <h4>最近の状態に戻す</h4>
          <p>起動時、同期前、復元前などに残した直近5件の状態へ戻します。</p>
        </div>
        {snapshots.length > 0 ? <div className="snapshot-list">
          {snapshots.map((snapshot) => <button key={snapshot.id} className="snapshot-item" disabled={restoringId !== null} onClick={() => void restoreSnapshot(snapshot)}>
            <span>{new Date(snapshot.createdAt).toLocaleString('ja-JP')}</span>
            <strong>記録 {snapshot.logCount}件</strong>
            <small>{snapshot.reason}</small>
          </button>)}
        </div> : <p className="snapshot-empty">まだ復旧スナップショットはありません。</p>}
      </section>
      {!configured && <section className="settings-section setup-hint"><h3>クラウド同期の準備</h3><p><code>public/config.js</code>にSupabaseのProject URLとPublishable keyを設定するとログインが有効になります。</p></section>}
      {message && <p className="settings-message" role="status">{message}</p>}
      {user && <button className="danger-button signout-button" onClick={() => void onSignOut()}>ログアウト</button>}
    </section>
  </div>;
}
