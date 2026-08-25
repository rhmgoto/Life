import type { LogEntry } from '@/domain/models';
import { formatShortDate } from '@/lib/date';

const typeLabel: Record<LogEntry['type'], string> = {
  PT: 'personal tubuyaki',
  BT: 'business tubuyaki',
  PM: 'personal manabi',
  BM: 'business manabi',
};

export function formatAiShare(logs: LogEntry[], from: string, to: string): string {
  const lines = [`【期間】`, `${from.replaceAll('-', '/')}〜${to.replaceAll('-', '/')}`, '', '【記録】'];
  const groups = new Map<string, LogEntry[]>();
  [...logs].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).forEach((log) => groups.set(log.date, [...(groups.get(log.date) ?? []), log]));
  const dates = [...groups.keys()].sort();
  if (!dates.length) lines.push('記録なし');
  dates.forEach((date) => {
    lines.push(formatShortDate(date));
    groups.get(date)?.forEach((log) => {
      const heading = log.title ? `${log.title}\n  ` : '';
      lines.push(`・[${typeLabel[log.type]}] ${heading}${log.body}${log.tags.length ? ` #${log.tags.join(' #')}` : ''}`);
    });
    lines.push('');
  });
  return lines.join('\n').trim();
}
