import type { AppData, LogEntry, ScheduleEvent } from '@/domain/models';

interface BackupFile {
  app: 'MyLog';
  version: 1;
  exportedAt: string;
  data: AppData;
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isLog(value: unknown): value is LogEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LogEntry>;
  return isString(item.id) && isString(item.date) && isString(item.time) && isString(item.body)
    && (item.type === 'P' || item.type === 'B' || item.type === 'TODO')
    && Array.isArray(item.tags) && item.tags.every(isString) && isString(item.createdAt) && isString(item.updatedAt);
}

function isEvent(value: unknown): value is ScheduleEvent {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ScheduleEvent>;
  return isString(item.id) && isString(item.date) && isString(item.startTime) && isString(item.title)
    && (item.source === 'local' || item.source === 'google') && isString(item.createdAt) && isString(item.updatedAt);
}

export function downloadBackup(data: AppData): void {
  const backup: BackupFile = { app: 'MyLog', version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mylog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readBackup(file: File): Promise<AppData> {
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (parsed.app !== 'MyLog' || parsed.version !== 1 || !parsed.data
    || !Array.isArray(parsed.data.logs) || !parsed.data.logs.every(isLog)
    || !Array.isArray(parsed.data.events) || !parsed.data.events.every(isEvent)) {
    throw new Error('MyLogのバックアップファイルとして読み込めません。');
  }
  return parsed.data;
}
