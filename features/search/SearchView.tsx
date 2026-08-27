import { useMemo, useState } from 'react';
import type { LogDraft, LogEntry, LogTypeId } from '@/domain/models';
import { LOG_TYPES } from '@/domain/models';
import { formatLongDate } from '@/lib/date';

const PAGE_SIZE = 50;
const DEFAULT_RECENT_COUNT = 30;

type EditDraftState = Omit<LogDraft, 'tags'> & { logId: string; tagsText: string };

interface Props {
  logs: LogEntry[];
  onOpenDate: (date: string) => void;
  onSaveLog: (log: LogEntry, draft: LogDraft) => Promise<void>;
}

export function SearchView({ logs, onOpenDate, onSaveLog }: Props) {
  const [types, setTypes] = useState<LogTypeId[]>([]);
  const [tag, setTag] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const tags = useMemo(() => [...new Set(logs.flatMap((log) => log.tags))].sort((a, b) => a.localeCompare(b, 'ja')), [logs]);
  const results = useMemo(() => {
    return logs
      .filter((log) => (!types.length || types.includes(log.type)) && (!tag || log.tags.includes(tag)))
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  }, [logs, types, tag]);
  const visibleResults = results.slice(0, types.length ? visibleCount : DEFAULT_RECENT_COUNT);
  const activeLog = visibleResults.find((log) => log.id === activeLogId) ?? visibleResults[0];
  const titleFor = (log: LogEntry) => {
    const fallbackTitle = log.body.trim().replace(/\s+/g, ' ').slice(0, 30);
    return log.title || fallbackTitle || '見出しなし';
  };
  const draft = activeLog && editDraft?.logId === activeLog.id ? editDraft : undefined;
  const editTitle = draft?.title ?? activeLog?.title ?? '';
  const editTime = draft?.time ?? activeLog?.time ?? '';
  const editType = draft?.type ?? activeLog?.type ?? 'PT';
  const editBody = draft?.body ?? activeLog?.body ?? '';
  const editTags = draft?.tagsText ?? activeLog?.tags.join(', ') ?? '';
  const editedTags = editTags.split(',').map((item) => item.trim().replace(/^#/, '')).filter(Boolean);
  const selectLog = (log: LogEntry) => {
    setActiveLogId(log.id);
    setEditDraft({ logId: log.id, date: log.date, time: log.time, title: log.title, body: log.body, type: log.type, tagsText: log.tags.join(', ') });
    setMessage('');
  };
  const updateDraft = (patch: Partial<Omit<EditDraftState, 'logId'>>) => {
    if (!activeLog) return;
    setEditDraft({
      logId: activeLog.id,
      date: activeLog.date,
      time: editTime,
      title: editTitle || undefined,
      body: editBody,
      type: editType,
      tagsText: editTags,
      ...patch,
    });
  };
  const dirty = !!activeLog && (
    editTitle.trim() !== (activeLog.title ?? '') ||
    editTime !== activeLog.time ||
    editType !== activeLog.type ||
    editBody.trim() !== activeLog.body ||
    editedTags.join('\n') !== activeLog.tags.join('\n')
  );
  const toggleType = (type: LogTypeId) => {
    const nextTypes = types.includes(type) ? types.filter((item) => item !== type) : [...types, type];
    setTypes(nextTypes);
    if (!nextTypes.length) setTag('');
    setVisibleCount(PAGE_SIZE);
    setActiveLogId(null);
  };
  const saveActiveLog = async () => {
    if (!activeLog || !editBody.trim() || !editTime) return;
    setSaving(true);
    setMessage('');
    try {
      await onSaveLog(activeLog, {
        date: activeLog.date,
        time: editTime,
        title: editTitle.trim() || undefined,
        body: editBody.trim(),
        type: editType,
        tags: editedTags,
      });
      setEditDraft(null);
      setMessage('保存しました');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };
  const clearFilters = () => {
    setTypes([]);
    setTag('');
    setVisibleCount(PAGE_SIZE);
    setActiveLogId(null);
  };

  return <div className="view search-view"><header className="view-header"><div><p className="eyebrow">REVIEW</p><h1>振り返り</h1><p>記録の種類を選び、必要に応じてタグで絞り込みます。</p></div></header>
    <section className="search-panel"><fieldset className="type-filter"><legend>種類</legend><div className="type-filter-buttons">{LOG_TYPES.map((item) => {
      const selected = types.includes(item.id);
      return <button key={item.id} type="button" className={selected ? `selected ${item.id.toLowerCase()}` : ''} aria-pressed={selected} onClick={() => toggleType(item.id)}>{item.id}<small>{item.label}</small></button>;
    })}</div></fieldset><label className="tag-filter">タグ<select value={tag} onChange={(event) => { setTag(event.target.value); setVisibleCount(PAGE_SIZE); setActiveLogId(null); }} disabled={!types.length}><option value="">すべてのタグ</option>{tags.map((item) => <option key={item} value={item}>#{item}</option>)}</select></label></section>
    <div className="result-heading"><h2>記録一覧</h2><span>{types.length ? `${results.length}件` : `直近${visibleResults.length}件`}</span>{types.length > 0 && <button onClick={clearFilters}>選択をクリア</button>}</div>
    <section className="review-browser">
      <div className="result-list">{visibleResults.map((log) => {
        const active = activeLog?.id === log.id;
        return <button key={log.id} className={`search-result compact${active ? ' active' : ''}`} onFocus={() => selectLog(log)} onClick={() => selectLog(log)} aria-pressed={active}><div className="result-meta"><time>{formatLongDate(log.date)}　{log.time}</time><span className={`type-badge ${log.type.toLowerCase()}`}>{log.type}</span></div><h3 className={`result-title${log.title ? '' : ' fallback'}`}>{titleFor(log)}</h3>{log.tags.length > 0 && <div className="tags">{log.tags.map((item) => <span key={item}>#{item}</span>)}</div>}<span className="result-arrow">›</span></button>;
      })}{!results.length && <div className="empty-state"><span>⌕</span><p>{types.length ? '選択した条件に合う記録がありません' : 'まだ記録がありません'}</p></div>}</div>
      {activeLog && <article className="review-detail">
        <header><div className="result-meta"><time>{formatLongDate(activeLog.date)}　{activeLog.time}</time><span className={`type-badge ${activeLog.type.toLowerCase()}`}>{activeLog.type}</span></div><button className="open-day-button" onClick={() => onOpenDate(activeLog.date)}>この日を開く</button></header>
        <div className="review-edit-form">
          <label>見出し<input value={editTitle} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="空白でも保存できます" /></label>
          <div className="form-row two"><label>日付<input type="date" value={activeLog.date} disabled /></label><label>時刻<input type="time" value={editTime} onChange={(event) => updateDraft({ time: event.target.value })} /></label></div>
          <div className="review-type-picker" role="group" aria-label="種類">{LOG_TYPES.map((item) => <button key={item.id} type="button" className={editType === item.id ? `active ${item.id.toLowerCase()}` : ''} onClick={() => updateDraft({ type: item.id })}>{item.id}</button>)}</div>
          <label>本文<textarea value={editBody} onChange={(event) => updateDraft({ body: event.target.value })} /></label>
          <label>タグ<input value={editTags} onChange={(event) => updateDraft({ tagsText: event.target.value })} placeholder="仕事, アイデア（カンマ区切り）" /></label>
          <footer>{message && <p role="status">{message}</p>}<button className="primary-button" disabled={!dirty || !editBody.trim() || !editTime || saving} onClick={() => void saveActiveLog()}>{saving ? '保存中…' : '保存する'}</button></footer>
        </div>
      </article>}
    </section>
    {types.length > 0 && visibleCount < results.length && <button className="load-more-button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>さらに表示</button>}
  </div>;
}
