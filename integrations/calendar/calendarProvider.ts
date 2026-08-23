import type { ScheduleEvent } from '@/domain/models';

export interface CalendarProvider {
  readonly id: string;
  readonly readOnly: boolean;
  listEvents(from: string, to: string): Promise<ScheduleEvent[]>;
}

// Google Calendar API連携時はこの境界の内側だけを実装する。
export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = 'google-calendar';
  readonly readOnly = true;
  async listEvents(): Promise<ScheduleEvent[]> { return []; }
}
