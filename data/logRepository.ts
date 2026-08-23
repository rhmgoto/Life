import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';

export interface LogRepository {
  getAll(): Promise<AppData>;
  saveLog(draft: LogDraft, id?: string): Promise<LogEntry>;
  deleteLog(id: string): Promise<void>;
  saveEvent(draft: EventDraft, id?: string): Promise<ScheduleEvent>;
  deleteEvent(id: string): Promise<void>;
}
