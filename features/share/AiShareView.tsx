import { useMemo, useState } from 'react';
import type { LogEntry } from '@/domain/models';
import { addDays, formatLongDate, toDateKey } from '@/lib/date';
import { formatAiShare } from '@/integrations/ai/formatShare';

type Scope = 'today' | '7days' | '30days' | 'custom' | 'selected' | 'tag';
const options: Array<{ id: Scope; label: string }> = [{ id: 'today', label: '今日' }, { id: '7days', label: '過去7日' }, { id: '30days', label: '過去30日' }, { id: 'custom', label: '指定期間' }, { id: 'selected', label: '選択したログ' }, { id: 'tag', label: '特定タグ' }];

export function AiShareView({ logs }: { logs: LogEntry[] }) {
  const today = toDateKey();
  const [scope, setScope] = useState<Scope>('7days');
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [tag, setTag] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const tags = useMemo(() => [...new Set(logs.flatMap((log) => log.tags))].sort((a, b) => a.localeCompare(b, 'ja')), [logs]);
  const range = useMemo(() => {
    if (scope === 'today') return { from: today, to: today };
    if (scope === '7days') return { from: addDays(today, -6), to: today };
    if (scope === '30days') return { from: addDays(today, -29), to: today };
    if (scope === 'selected') {
      const dates = logs.filter((log) => selected.includes(log.id)).map((log) => log.date).sort();
      return { from: dates[0] ?? today, to: dates[dates.length - 1] ?? today };
    }
    return { from, to };
  }, [scope, from, to, today, logs, selected]);
  const includedLogs = useMemo(() => logs.filter((log) => scope === 'selected' ? selected.includes(log.id) : scope === 'tag' ? (!tag || log.tags.includes(tag)) && log.date >= range.from && log.date <= range.to : log.date >= range.from && log.date <= range.to), [logs, scope, selected, tag, range]);
  const output = useMemo(() => formatAiShare(includedLogs, range.from, range.to), [includedLogs, range]);
  const copy = async () => { await navigator.clipboard.writeText(output); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <div className="view share-view"><header className="view-header share-header"><div><p className="eyebrow">AI SHARE</p><h1>AI共有</h1><p>記録を読みやすい文章に整えて、AIとの対話に使えます。</p></div><span className="privacy-note">内容は外部へ送信されません</span></header>
    <div className="share-layout"><section className="share-settings"><h2>共有する範囲</h2><div className="scope-grid">{options.map((option) => <button key={option.id} className={scope === option.id ? 'active' : ''} onClick={() => setScope(option.id)}>{option.label}</button>)}</div>
      {scope === 'custom' && <div className="custom-range"><label>開始日<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><span>〜</span><label>終了日<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>}
      {scope === 'tag' && <div className="tag-picker"><label>タグ<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">タグを選択</option>{tags.map((item) => <option key={item} value={item}>#{item}</option>)}</select></label><div className="custom-range"><label>開始日<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><span>〜</span><label>終了日<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div></div>}
      {scope === 'selected' && <div className="log-picker"><p>共有するログを選択</p>{[...logs].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).map((log) => <label key={log.id}><input type="checkbox" checked={selected.includes(log.id)} onChange={() => setSelected((items) => items.includes(log.id) ? items.filter((id) => id !== log.id) : [...items, log.id])} /><span><strong>{formatLongDate(log.date)} {log.time}</strong>{log.title || log.body}</span></label>)}</div>}
      <div className="share-summary"><span>対象期間</span><strong>{range.from.replaceAll('-', '/')} 〜 {range.to.replaceAll('-', '/')}</strong><p>記録 {includedLogs.length}件</p></div>
    </section>
    <section className="share-output"><header><div><p className="eyebrow">COPY TEXT</p><h2>コピー用テキスト</h2></div><button className="primary-button" onClick={copy}>{copied ? 'コピーしました ✓' : 'コピーする'}</button></header><pre>{output}</pre><p className="output-note">このテキストをChatGPTなどに貼り付けて、振り返りや相談に使えます。</p></section></div>
  </div>;
}
