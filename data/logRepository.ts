import type { RecoverySnapshot } from '@/data/indexedDbRepository';
import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';

export interface LogRepository {
  getAll(): Promise<AppData>;
  importData(data: AppData): Promise<void>;
  createDailyRecoverySnapshot(): Promise<boolean>;
  getRecoverySnapshots(): Promise<RecoverySnapshot[]>;
  restoreRecoverySnapshot(id: string): Promise<AppData>;
  saveLog(draft: LogDraft, id?: string): Promise<LogEntry>;
  deleteLog(id: string): Promise<void>;
  saveEvent(draft: EventDraft, id?: string): Promise<ScheduleEvent>;
  deleteEvent(id: string): Promise<void>;
}
