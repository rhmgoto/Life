import { useState } from 'react';
import type { EventDraft, ScheduleEvent } from '@/domain/models';

export function EventEditor({ date, value, onClose, onSave, onDelete }: { date: string; value?: ScheduleEvent; onClose: () => void; onSave: (draft: EventDraft) => void; onDelete?: () => void }) {
  const [startTime, setStartTime] = useState(value?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(value?.endTime ?? '');
  const [title, setTitle] = useState(value?.title ?? '');
  const [memo, setMemo] = useState(value?.memo ?? '');
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="editor compact" role="dialog" aria-modal="true" aria-labelledby="event-editor-title">
    <header><div><p className="eyebrow">SCHEDULE</p><h2 id="event-editor-title">{value ? '予定を編集' : '予定を追加'}</h2></div><button className="icon-button" onClick={onClose} aria-label="閉じる">×</button></header>
    <label>日付<input type="date" value={date} disabled /></label>
    <div className="form-row two"><label>開始<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>終了（任意）<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div>
    <label>タイトル<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="予定の名前" /></label>
    <label>メモ（任意）<textarea rows={3} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="場所や補足" /></label>
    <footer>{onDelete && <button className="danger-button" onClick={onDelete}>削除</button>}<span /><button className="ghost-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!title.trim() || !startTime} onClick={() => onSave({ date, startTime, endTime: endTime || undefined, title: title.trim(), memo: memo.trim() || undefined })}>保存する</button></footer>
  </section></div>;
}
