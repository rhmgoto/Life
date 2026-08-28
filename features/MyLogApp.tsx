'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppNavigation, type ViewName } from '@/components/AppNavigation';
import { DataSettings } from '@/components/DataSettings';
import { LoginScreen } from '@/components/LoginScreen';
import { LogEditor } from '@/components/LogEditor';
import { tryDailyLocalFileBackup } from '@/data/fileBackup';
import { IndexedDbLogRepository } from '@/data/indexedDbRepository';
import type { LogRepository } from '@/data/logRepository';
import { SupabaseDataStore } from '@/data/supabaseDataStore';
import { SyncedLogRepository, type SyncState } from '@/data/syncedLogRepository';
import type { AppData, LogDraft, LogEntry } from '@/domain/models';
import { CalendarView } from '@/features/calendar/CalendarView';
import { SearchView } from '@/features/search/SearchView';
import { AiShareView } from '@/features/share/AiShareView';
import { TodayView } from '@/features/today/TodayView';
import { toDateKey } from '@/lib/date';
import { getSupabaseClient, isSupabaseConfigured, restoreSupabaseSession } from '@/lib/supabaseClient';

const localRepository = new IndexedDbLogRepository();

export function MyLogApp() {
  const [view, setView] = useState<ViewName>('today');
  const [date, setDate] = useState(toDateKey());
  const [data, setData] = useState<AppData>({ logs: [], events: [] });
  const [ready, setReady] = useState(false);
  const [configured] = useState(() => isSupabaseConfigured());
  const [authReady, setAuthReady] = useState(() => !configured);
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogEntry | null | 'new'>(null);

  useEffect(() => {
    if (!configured) return;
    const client = getSupabaseClient();
    void restoreSupabaseSession()
      .then((restoredSession) => setSession(restoredSession))
      .finally(() => setAuthReady(true));
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, [configured]);

  const repository = useMemo<LogRepository>(() => {
    if (!session) return localRepository;
    return new SyncedLogRepository(
      localRepository,
      new SupabaseDataStore(getSupabaseClient(), session.user.id),
      session.user.id,
      setSyncState,
    );
  }, [session]);

  const refresh = useCallback(async () => {
    try {
      await repository.createDailyRecoverySnapshot();
    } catch (error) {
      console.warn('Daily recovery snapshot failed.', error);
    }
    const nextData = await repository.getAll();
    void tryDailyLocalFileBackup(nextData).catch((error) => {
      console.warn('Daily local file backup failed.', error);
    });
    setData(nextData);
    setReady(true);
  }, [repository]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const sync = () => void refresh();
    const interval = window.setInterval(sync, 30_000);
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    return () => { window.clearInterval(interval); window.removeEventListener('online', sync); window.removeEventListener('focus', sync); };
  }, [session, refresh]);

  const dayLogs = useMemo(() => data.logs.filter((log) => log.date === date).sort((a, b) => a.time.localeCompare(b.time)), [data.logs, date]);
  const openDay = (nextDate: string) => { setDate(nextDate); setView('today'); };
  const saveLog = async (draft: LogDraft) => { await repository.saveLog(draft, typeof editingLog === 'object' && editingLog ? editingLog.id : undefined); setEditingLog(null); await refresh(); };
  const updateLog = async (log: LogEntry, draft: LogDraft) => { await repository.saveLog(draft, log.id); await refresh(); };
  const deleteLog = async () => { if (typeof editingLog === 'object' && editingLog) { await repository.deleteLog(editingLog.id); setEditingLog(null); await refresh(); } };

  if (!authReady || !ready) return <main className="auth-shell"><div className="loading-state"><span className="brand-mark">M</span><p>記録をひらいています…</p></div></main>;
  if (configured && !session) return <LoginScreen localData={data} />;

  const storageLabel = session
    ? syncState === 'syncing' ? '同期中…' : syncState === 'offline' ? '端末に保存・再接続待ち' : 'クラウド同期済み'
    : 'この端末に保存中';

  return <main className="app-shell">
    <AppNavigation view={view} storageLabel={storageLabel} onChange={(next) => { setView(next); if (next === 'today') setDate(toDateKey()); }} />
    <section className="content">
      <button className={`sync-chip ${syncState}`} onClick={() => setSettingsOpen(true)} aria-label="保存と同期の設定を開く"><span>●</span>{storageLabel}<b>⋯</b></button>
      <>
        {view === 'today' && <TodayView date={date} logs={dayLogs} onDateChange={setDate} onNewLog={() => setEditingLog('new')} onEditLog={setEditingLog} />}
        {view === 'calendar' && <CalendarView selectedDate={date} logs={data.logs} onMonthChange={setDate} onOpenDate={openDay} />}
        {view === 'search' && <SearchView logs={data.logs} onOpenDate={openDay} onSaveLog={updateLog} />}
        {view === 'share' && <AiShareView logs={data.logs} />}
      </>
    </section>
    {editingLog && <LogEditor date={date} value={typeof editingLog === 'object' ? editingLog : undefined} onClose={() => setEditingLog(null)} onSave={(draft) => void saveLog(draft)} onDelete={typeof editingLog === 'object' ? () => void deleteLog() : undefined} />}
    {settingsOpen && <DataSettings data={data} repository={repository} user={session?.user ?? null} configured={configured} onClose={() => setSettingsOpen(false)} onImported={refresh} onSignOut={async () => { await getSupabaseClient().auth.signOut(); setSettingsOpen(false); }} />}
  </main>;
}
