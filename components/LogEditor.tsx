import { useState } from 'react';
import type { LogDraft, LogEntry, LogTypeId } from '@/domain/models';
import { LOG_TYPES } from '@/domain/models';
import { currentTime } from '@/lib/date';

export function LogEditor({ date, value, onClose, onSave, onDelete }: { date: string; value?: LogEntry; onClose: () => void; onSave: (draft: LogDraft) => void; onDelete?: () => void }) {
  const [time, setTime] = useState(value?.time ?? currentTime());
  const [body, setBody] = useState(value?.body ?? '');
  const [type, setType] = useState<LogTypeId>(value?.type ?? 'P');
  const [tags, setTags] = useState(value?.tags.join(', ') ?? '');
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="editor" role="dialog" aria-modal="true" aria-labelledby="log-editor-title">
    <header><div><p className="eyebrow">LOG ENTRY</p><h2 id="log-editor-title">{value ? '記録を編集' : '記録を書く'}</h2></div><button className="icon-button" onClick={onClose} aria-label="閉じる">×</button></header>
    <div className="form-row two"><label>日付<input type="date" value={date} disabled /></label><label>時刻<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
    <label>種類<select value={type} onChange={(event) => setType(event.target.value as LogTypeId)}>{LOG_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.description}</option>)}</select></label>
    <label>本文<textarea autoFocus rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder="今、残しておきたいことは？" /></label>
    <label>タグ<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="仕事, アイデア（カンマ区切り）" /></label>
    <footer>{onDelete && <button className="danger-button" onClick={onDelete}>削除</button>}<span /><button className="ghost-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!body.trim() || !time} onClick={() => onSave({ date, time, body: body.trim(), type, tags: tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean) })}>保存する</button></footer>
  </section></div>;
}
