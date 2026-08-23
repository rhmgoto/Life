export const LOG_TYPES = [
  { id: 'P', label: 'P', description: '出来事・考え' },
  { id: 'B', label: 'B', description: 'アイデア' },
  { id: 'TODO', label: 'TODO', description: 'やること' },
] as const;

export type LogTypeId = (typeof LOG_TYPES)[number]['id'];

export interface LogEntry {
  id: string;
  date: string;
  time: string;
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

export type LogDraft = Pick<LogEntry, 'date' | 'time' | 'body' | 'type' | 'tags'>;
export type EventDraft = Pick<ScheduleEvent, 'date' | 'startTime' | 'endTime' | 'title' | 'memo'>;
