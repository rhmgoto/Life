import type { LogEntry, ScheduleEvent } from '@/domain/models';
import { formatLongDate, toDateKey, weekdayLabel } from '@/lib/date';

const typeClass: Record<LogEntry['type'], string> = { P: 'p', B: 'b', TODO: 'todo' };

export function TodayView({ date, logs, events, onDateChange, onNewLog, onNewEvent, onEditLog, onEditEvent }: { date: string; logs: LogEntry[]; events: ScheduleEvent[]; onDateChange: (date: string) => void; onNewLog: () => void; onNewEvent: () => void; onEditLog: (log: LogEntry) => void; onEditEvent: (event: ScheduleEvent) => void }) {
  const isToday = date === toDateKey();
  return <div className="view today-view">
    <header className="day-header"><div><p className="eyebrow">{isToday ? 'TODAY' : 'DAILY LOG'}</p><h1>{formatLongDate(date)}</h1><p className="weekday">{weekdayLabel(date)}</p></div><label className="date-button"><span aria-hidden="true">□</span><span>日付を選ぶ</span><input aria-label="表示する日付" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label></header>
    <section className="section-block"><div className="section-title"><h2>{isToday ? '今日' : 'この日'}の予定</h2><button onClick={onNewEvent}>＋ 予定を追加</button></div>
      {!events.length && <div className="empty-state"><span>○</span><p>予定はありません</p></div>}
      {events.map((event, index) => <button className="schedule-card" key={event.id} onClick={() => onEditEvent(event)}><time>{event.startTime}{event.endTime && <small>〜{event.endTime}</small>}</time><span className={`schedule-line tone-${index % 3}`} /><div><strong>{event.title}</strong>{event.memo && <p>{event.memo}</p>}</div>{event.source === 'google' && <span className="source-badge">Google</span>}</button>)}
    </section>
    <section className="section-block logs-block"><div className="section-title"><h2>{isToday ? '今日' : 'この日'}のログ</h2><span className="count">{logs.length}件</span></div>
      {!logs.length && <div className="empty-state"><span>＋</span><p>まだ記録がありません</p><button onClick={onNewLog}>最初の記録を書く</button></div>}
      {logs.map((log) => <button className="log-card" key={log.id} onClick={() => onEditLog(log)}><time>{log.time}</time><div><span className={`type-badge ${typeClass[log.type]}`}>{log.type}</span><p>{log.body}</p>{log.tags.length > 0 && <div className="tags">{log.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}</div><span className="edit-hint" aria-hidden="true">···</span></button>)}
    </section>
    <button className="compose-button" onClick={onNewLog}><span>＋</span>記録を書く</button>
  </div>;
}
