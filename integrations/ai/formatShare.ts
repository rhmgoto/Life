import type { LogEntry, ScheduleEvent } from '@/domain/models';
import { formatShortDate } from '@/lib/date';

const typeLabel: Record<LogEntry['type'], string> = { P: '私生活・日常', B: '仕事関係' };

export function formatAiShare(logs: LogEntry[], events: ScheduleEvent[], from: string, to: string): string {
  const lines = [`【期間】`, `${from.replaceAll('-', '/')}〜${to.replaceAll('-', '/')}`, '', '【予定】'];
  const sortedEvents = [...events].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  if (!sortedEvents.length) lines.push('予定なし');
  sortedEvents.forEach((event) => lines.push(`${formatShortDate(event.date)} ${event.startTime}${event.endTime ? `〜${event.endTime}` : ''} ${event.title}${event.memo ? `（${event.memo}）` : ''}`));
  lines.push('', '【記録】');
  const groups = new Map<string, LogEntry[]>();
  [...logs].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).forEach((log) => groups.set(log.date, [...(groups.get(log.date) ?? []), log]));
  const dates = [...groups.keys()].sort();
  if (!dates.length) lines.push('記録なし');
  dates.forEach((date) => {
    lines.push(formatShortDate(date));
    groups.get(date)?.forEach((log) => lines.push(`・[${typeLabel[log.type]}] ${log.body}${log.tags.length ? ` #${log.tags.join(' #')}` : ''}`));
    lines.push('');
  });
  return lines.join('\n').trim();
}
