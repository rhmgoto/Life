import type { AppData, LogEntry, ScheduleEvent } from '@/domain/models';

export interface CloudDataStore {
  getAll(): Promise<AppData>;
  upsertLog(record: LogEntry): Promise<LogEntry>;
  deleteLog(id: string): Promise<LogEntry | undefined>;
  upsertEvent(record: ScheduleEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
