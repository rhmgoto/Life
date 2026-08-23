import { useMemo, useState } from 'react';
import type { LogEntry, LogTypeId } from '@/domain/models';
import { LOG_TYPES } from '@/domain/models';
import { formatLongDate } from '@/lib/date';

export function SearchView({ logs, onOpenDate }: { logs: LogEntry[]; onOpenDate: (date: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<LogTypeId | ''>('');
  const [tag, setTag] = useState('');
  const tags = useMemo(() => [...new Set(logs.flatMap((log) => log.tags))].sort((a, b) => a.localeCompare(b, 'ja')), [logs]);
  const results = useMemo(() => logs.filter((log) => {
    const word = keyword.trim().toLocaleLowerCase();
    return (!word || `${log.body} ${log.tags.join(' ')}`.toLocaleLowerCase().includes(word)) && (!date || log.date === date) && (!type || log.type === type) && (!tag || log.tags.includes(tag));
  }).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)), [logs, keyword, date, type, tag]);
  return <div className="view search-view"><header className="view-header"><div><p className="eyebrow">SEARCH</p><h1>過去ログを探す</h1><p>言葉・日付・種類・タグから、記録を見つけます。</p></div></header>
    <section className="search-panel"><label className="search-input"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="キーワードを入力" /></label><div className="filter-row"><label>日付<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>種類<select value={type} onChange={(event) => setType(event.target.value as LogTypeId | '')}><option value="">すべて</option>{LOG_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>タグ<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">すべて</option>{tags.map((item) => <option key={item} value={item}>#{item}</option>)}</select></label></div></section>
    <div className="result-heading"><h2>検索結果</h2><span>{results.length}件</span>{(keyword || date || type || tag) && <button onClick={() => { setKeyword(''); setDate(''); setType(''); setTag(''); }}>条件をクリア</button>}</div>
    <section className="result-list">{results.map((log) => <button key={log.id} className="search-result" onClick={() => onOpenDate(log.date)}><div className="result-meta"><time>{formatLongDate(log.date)}　{log.time}</time><span className={`type-badge ${log.type.toLowerCase()}`}>{log.type}</span></div><p>{log.body}</p><div className="tags">{log.tags.map((item) => <span key={item}>#{item}</span>)}</div><span className="result-arrow">›</span></button>)}{!results.length && <div className="empty-state"><span>⌕</span><p>条件に合う記録がありません</p></div>}</section>
  </div>;
}
