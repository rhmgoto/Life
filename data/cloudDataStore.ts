import type { AppData, LogEntry, ScheduleEvent } from '@/domain/models';

export interface CloudDataStore {
  getAll(): Promise<AppData>;
  upsertLog(record: LogEntry): Promise<void>;
  deleteLog(id: string): Promise<void>;
  upsertEvent(record: ScheduleEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
