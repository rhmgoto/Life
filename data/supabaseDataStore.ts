import type { SupabaseClient } from '@supabase/supabase-js';
import type { CloudDataStore } from '@/data/cloudDataStore';
import type { AppData, LogEntry, ScheduleEvent } from '@/domain/models';

type LogRow = {
  id: string; date: string; time: string; body: string; type: LogEntry['type']; tags: string[];
  created_at: string; updated_at: string;
};
type EventRow = {
  id: string; date: string; start_time: string; end_time: string | null; title: string; memo: string | null;
  source: ScheduleEvent['source']; external_id: string | null; calendar_id: string | null;
  created_at: string; updated_at: string;
};

export class SupabaseDataStore implements CloudDataStore {
  constructor(private client: SupabaseClient, private userId: string) {}

  async getAll(): Promise<AppData> {
    const [logsResult, eventsResult] = await Promise.all([
      this.client.from('logs').select('*').eq('user_id', this.userId).order('date').order('time'),
      this.client.from('events').select('*').eq('user_id', this.userId).order('date').order('start_time'),
    ]);
    if (logsResult.error) throw logsResult.error;
    if (eventsResult.error) throw eventsResult.error;
    return {
      logs: (logsResult.data as LogRow[]).map((row) => ({
        id: row.id, date: row.date, time: row.time.slice(0, 5), body: row.body, type: row.type,
        tags: row.tags ?? [], createdAt: row.created_at, updatedAt: row.updated_at,
      })),
      events: (eventsResult.data as EventRow[]).map((row) => ({
        id: row.id, date: row.date, startTime: row.start_time.slice(0, 5),
        endTime: row.end_time?.slice(0, 5) || undefined, title: row.title, memo: row.memo || undefined,
        source: row.source, externalId: row.external_id || undefined, calendarId: row.calendar_id || undefined,
        createdAt: row.created_at, updatedAt: row.updated_at,
      })),
    };
  }

  async upsertLog(record: LogEntry): Promise<void> {
    const { error } = await this.client.from('logs').upsert({
      id: record.id, user_id: this.userId, date: record.date, time: record.time, body: record.body,
      type: record.type, tags: record.tags, created_at: record.createdAt, updated_at: record.updatedAt,
    }, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  async deleteLog(id: string): Promise<void> {
    const { error } = await this.client.from('logs').delete().eq('user_id', this.userId).eq('id', id);
    if (error) throw error;
  }

  async upsertEvent(record: ScheduleEvent): Promise<void> {
    const { error } = await this.client.from('events').upsert({
      id: record.id, user_id: this.userId, date: record.date, start_time: record.startTime,
      end_time: record.endTime ?? null, title: record.title, memo: record.memo ?? null, source: record.source,
      external_id: record.externalId ?? null, calendar_id: record.calendarId ?? null,
      created_at: record.createdAt, updated_at: record.updatedAt,
    }, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  async deleteEvent(id: string): Promise<void> {
    const { error } = await this.client.from('events').delete().eq('user_id', this.userId).eq('id', id);
    if (error) throw error;
  }
}
