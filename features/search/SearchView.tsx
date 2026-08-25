import { useMemo, useState } from 'react';
import type { LogEntry, LogTypeId } from '@/domain/models';
import { LOG_TYPES } from '@/domain/models';
import { formatLongDate } from '@/lib/date';

const PAGE_SIZE = 50;

export function SearchView({ logs, onOpenDate }: { logs: LogEntry[]; onOpenDate: (date: string) => void }) {
  const [types, setTypes] = useState<LogTypeId[]>([]);
  const [tag, setTag] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const tags = useMemo(() => [...new Set(logs.flatMap((log) => log.tags))].sort((a, b) => a.localeCompare(b, 'ja')), [logs]);
  const results = useMemo(() => {
    if (!types.length) return [];
    return logs
      .filter((log) => types.includes(log.type) && (!tag || log.tags.includes(tag)))
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  }, [logs, types, tag]);
  const visibleResults = results.slice(0, visibleCount);
  const toggleType = (type: LogTypeId) => {
    const nextTypes = types.includes(type) ? types.filter((item) => item !== type) : [...types, type];
    setTypes(nextTypes);
    if (!nextTypes.length) setTag('');
    setVisibleCount(PAGE_SIZE);
  };
  const clearFilters = () => {
    setTypes([]);
    setTag('');
    setVisibleCount(PAGE_SIZE);
  };

  return <div className="view search-view"><header className="view-header"><div><p className="eyebrow">REVIEW</p><h1>振り返り</h1><p>記録の種類を選び、必要に応じてタグで絞り込みます。</p></div></header>
    <section className="search-panel"><fieldset className="type-filter"><legend>種類</legend><div className="type-filter-buttons">{LOG_TYPES.map((item) => {
      const selected = types.includes(item.id);
      return <button key={item.id} type="button" className={selected ? `selected ${item.id.toLowerCase()}` : ''} aria-pressed={selected} onClick={() => toggleType(item.id)}>{item.id}<small>{item.label}</small></button>;
    })}</div></fieldset><label className="tag-filter">タグ<select value={tag} onChange={(event) => { setTag(event.target.value); setVisibleCount(PAGE_SIZE); }} disabled={!types.length}><option value="">すべてのタグ</option>{tags.map((item) => <option key={item} value={item}>#{item}</option>)}</select></label></section>
    <div className="result-heading"><h2>記録一覧</h2><span>{types.length ? `${results.length}件` : ''}</span>{types.length > 0 && <button onClick={clearFilters}>選択をクリア</button>}</div>
    <section className="result-list">{visibleResults.map((log) => {
      const fallbackTitle = log.body.trim().replace(/\s+/g, ' ').slice(0, 30);
      return <button key={log.id} className="search-result compact" onClick={() => onOpenDate(log.date)}><div className="result-meta"><time>{formatLongDate(log.date)}　{log.time}</time><span className={`type-badge ${log.type.toLowerCase()}`}>{log.type}</span></div><h3 className={`result-title${log.title ? '' : ' fallback'}`}>{log.title || fallbackTitle || '見出しなし'}</h3>{log.tags.length > 0 && <div className="tags">{log.tags.map((item) => <span key={item}>#{item}</span>)}</div>}<span className="result-arrow">›</span></button>;
    })}{!types.length && <div className="empty-state"><span>□</span><p>PT・BT・PM・BMから<br />振り返りたい種類を選んでください</p></div>}{types.length > 0 && !results.length && <div className="empty-state"><span>⌕</span><p>選択した条件に合う記録がありません</p></div>}</section>
    {visibleCount < results.length && <button className="load-more-button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>さらに表示</button>}
  </div>;
}
