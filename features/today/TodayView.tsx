import type { LogEntry } from '@/domain/models';
import { formatLongDate, toDateKey, weekdayLabel } from '@/lib/date';

const typeClass: Record<LogEntry['type'], string> = { PT: 'pt', BT: 'bt', PM: 'pm', BM: 'bm' };

export function TodayView({ date, logs, onDateChange, onNewLog, onEditLog }: { date: string; logs: LogEntry[]; onDateChange: (date: string) => void; onNewLog: () => void; onEditLog: (log: LogEntry) => void }) {
  const isToday = date === toDateKey();
  return <div className="view today-view">
    <header className="day-header"><div><p className="eyebrow">{isToday ? 'TODAY' : 'DAILY LOG'}</p><h1>{formatLongDate(date)}</h1><p className="weekday">{weekdayLabel(date)}</p></div><label className="date-button"><span aria-hidden="true">□</span><span>日付を選ぶ</span><input aria-label="表示する日付" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label></header>
    <section className="section-block logs-block"><div className="section-title"><h2>{isToday ? '今日' : 'この日'}のログ</h2><span className="count">{logs.length}件</span></div>
      {!logs.length && <div className="empty-state"><span>＋</span><p>まだ記録がありません</p><button onClick={onNewLog}>最初の記録を書く</button></div>}
      {logs.map((log) => <button className="log-card" key={log.id} onClick={() => onEditLog(log)}><time>{log.time}</time><div><span className={`type-badge ${typeClass[log.type]}`}>{log.type}</span>{log.title && <h3 className="log-title">{log.title}</h3>}<p>{log.body}</p>{log.tags.length > 0 && <div className="tags">{log.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}</div><span className="edit-hint" aria-hidden="true">···</span></button>)}
    </section>
    <button className="compose-button" onClick={onNewLog}><span>＋</span>記録を書く</button>
  </div>;
}
