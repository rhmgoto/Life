import type { LogEntry } from '@/domain/models';
import { calendarCells, monthKey, parseDateKey, toDateKey } from '@/lib/date';

const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

export function CalendarView({ selectedDate, logs, onMonthChange, onOpenDate }: { selectedDate: string; logs: LogEntry[]; onMonthChange: (date: string) => void; onOpenDate: (date: string) => void }) {
  const month = monthKey(selectedDate);
  const [year, monthNumber] = month.split('-').map(Number);
  const move = (amount: number) => {
    const date = parseDateKey(`${month}-01`);
    date.setMonth(date.getMonth() + amount);
    onMonthChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };
  const counts = new Map<string, number>();
  logs.forEach((log) => counts.set(log.date, (counts.get(log.date) ?? 0) + 1));
  return <div className="view calendar-view"><header className="view-header"><div><p className="eyebrow">CALENDAR</p><h1>カレンダー</h1><p>記録を月ごとに眺めます。</p></div></header>
    <section className="calendar-card"><div className="calendar-toolbar"><button aria-label="前の月" onClick={() => move(-1)}>‹</button><h2>{year}年 {monthNumber}月</h2><button aria-label="次の月" onClick={() => move(1)}>›</button></div>
      <div className="calendar-grid day-labels">{dayNames.map((name) => <span key={name}>{name}</span>)}</div>
      <div className="calendar-grid">{calendarCells(month).map((date, index) => date ? <button key={date} className={`${date === toDateKey() ? 'today' : ''} ${date === selectedDate ? 'selected' : ''}`} onClick={() => onOpenDate(date)}><span>{Number(date.slice(-2))}</span><div className="calendar-dots">{(counts.get(date) ?? 0) > 0 && <i className="log-dot" />}</div></button> : <span className="blank" key={`blank-${index}`} />)}</div>
      <footer className="calendar-legend"><span><i className="log-dot" />ログ</span></footer>
    </section>
    <button className="open-day-button" onClick={() => onOpenDate(selectedDate)}>選択した日のページを開く</button>
  </div>;
}
