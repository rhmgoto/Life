'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppNavigation, type ViewName } from '@/components/AppNavigation';
import { EventEditor } from '@/components/EventEditor';
import { LogEditor } from '@/components/LogEditor';
import { IndexedDbLogRepository } from '@/data/indexedDbRepository';
import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';
import { CalendarView } from '@/features/calendar/CalendarView';
import { SearchView } from '@/features/search/SearchView';
import { AiShareView } from '@/features/share/AiShareView';
import { TodayView } from '@/features/today/TodayView';
import { toDateKey } from '@/lib/date';

const repository = new IndexedDbLogRepository();

export function MyLogApp() {
  const [view, setView] = useState<ViewName>('today');
  const [date, setDate] = useState(toDateKey());
  const [data, setData] = useState<AppData>({ logs: [], events: [] });
  const [ready, setReady] = useState(false);
  const [editingLog, setEditingLog] = useState<LogEntry | null | 'new'>(null);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null | 'new'>(null);

  const refresh = async () => { setData(await repository.getAll()); setReady(true); };
  useEffect(() => { void refresh(); }, []);

  const dayLogs = useMemo(() => data.logs.filter((log) => log.date === date).sort((a, b) => a.time.localeCompare(b.time)), [data.logs, date]);
  const dayEvents = useMemo(() => data.events.filter((event) => event.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)), [data.events, date]);
  const openDay = (nextDate: string) => { setDate(nextDate); setView('today'); };
  const saveLog = async (draft: LogDraft) => { await repository.saveLog(draft, typeof editingLog === 'object' && editingLog ? editingLog.id : undefined); setEditingLog(null); await refresh(); };
  const deleteLog = async () => { if (typeof editingLog === 'object' && editingLog) { await repository.deleteLog(editingLog.id); setEditingLog(null); await refresh(); } };
  const saveEvent = async (draft: EventDraft) => { await repository.saveEvent(draft, typeof editingEvent === 'object' && editingEvent ? editingEvent.id : undefined); setEditingEvent(null); await refresh(); };
  const deleteEvent = async () => { if (typeof editingEvent === 'object' && editingEvent) { await repository.deleteEvent(editingEvent.id); setEditingEvent(null); await refresh(); } };

  return <main className="app-shell">
    <AppNavigation view={view} onChange={(next) => { setView(next); if (next === 'today') setDate(toDateKey()); }} />
    <section className="content">
      {!ready ? <div className="loading-state"><span className="brand-mark">M</span><p>記録をひらいています…</p></div> : <>
        {view === 'today' && <TodayView date={date} logs={dayLogs} events={dayEvents} onDateChange={setDate} onNewLog={() => setEditingLog('new')} onNewEvent={() => setEditingEvent('new')} onEditLog={setEditingLog} onEditEvent={setEditingEvent} />}
        {view === 'calendar' && <CalendarView selectedDate={date} logs={data.logs} events={data.events} onMonthChange={setDate} onOpenDate={openDay} />}
        {view === 'search' && <SearchView logs={data.logs} onOpenDate={openDay} />}
        {view === 'share' && <AiShareView logs={data.logs} events={data.events} />}
      </>}
    </section>
    {editingLog && <LogEditor date={date} value={typeof editingLog === 'object' ? editingLog : undefined} onClose={() => setEditingLog(null)} onSave={(draft) => void saveLog(draft)} onDelete={typeof editingLog === 'object' ? () => void deleteLog() : undefined} />}
    {editingEvent && <EventEditor date={date} value={typeof editingEvent === 'object' ? editingEvent : undefined} onClose={() => setEditingEvent(null)} onSave={(draft) => void saveEvent(draft)} onDelete={typeof editingEvent === 'object' ? () => void deleteEvent() : undefined} />}
  </main>;
}
