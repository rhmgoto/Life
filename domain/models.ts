export const LOG_TYPES = [
  { id: 'PT', label: 'PT', description: 'personal tubuyaki' },
  { id: 'BT', label: 'BT', description: 'business tubuyaki' },
  { id: 'PM', label: 'PM', description: 'personal manabi' },
  { id: 'BM', label: 'BM', description: 'business manabi' },
] as const;

export type LogTypeId = (typeof LOG_TYPES)[number]['id'];

export function normalizeLogType(value: unknown): LogTypeId {
  if (value === 'PT' || value === 'BT' || value === 'PM' || value === 'BM') return value;
  return value === 'B' ? 'BT' : 'PT';
}

export interface LogEntry {
  id: string;
  date: string;
  time: string;
  title?: string;
  body: string;
  type: LogTypeId;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEvent {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  title: string;
  memo?: string;
  source: 'local' | 'google';
  externalId?: string;
  calendarId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  logs: LogEntry[];
  events: ScheduleEvent[];
}

export type LogDraft = Pick<LogEntry, 'date' | 'time' | 'title' | 'body' | 'type' | 'tags'>;
export type EventDraft = Pick<ScheduleEvent, 'date' | 'startTime' | 'endTime' | 'title' | 'memo'>;
