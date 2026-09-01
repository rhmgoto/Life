import type { SupabaseClient } from '@supabase/supabase-js';
import type { CloudDataStore } from '@/data/cloudDataStore';
import type { AppData, LogEntry, ScheduleEvent } from '@/domain/models';
import { normalizeLogType } from '@/domain/models';

type LogRow = {
  id: string; date: string; time: string; title: string | null; body: string; type: LogEntry['type']; tags: string[];
  created_at: string; updated_at: string; revision?: number; deleted_at?: string | null;
};

const isMissingDeletedAtColumn = (error: unknown): boolean => {
  if (!error || typeof error !== 'object' || !('message' in error) || typeof error.message !== 'string') return false;
  return error.message.includes("'deleted_at' column") || error.message.includes('deleted_at');
};

export class SupabaseDataStore implements CloudDataStore {
  constructor(private client: SupabaseClient, private userId: string) {}

  private toLogEntry(row: LogRow): LogEntry {
    return {
      id: row.id, date: row.date, time: row.time.slice(0, 5), title: row.title || undefined,
      body: row.body, type: normalizeLogType(row.type), tags: row.tags ?? [],
      createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision,
      deletedAt: row.deleted_at || undefined,
    };
  }

  private async getAllLogRows(): Promise<LogRow[]> {
    const rows: LogRow[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const result = await this.client.from('logs').select('*').eq('user_id', this.userId)
        .order('date').order('time').range(from, from + pageSize - 1);
      if (result.error) throw result.error;
      const page = result.data as LogRow[];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async getAll(): Promise<AppData> {
    const logRows = await this.getAllLogRows();
    return {
      logs: logRows.map((row) => this.toLogEntry(row)),
      events: [],
    };
  }

  async upsertLog(record: LogEntry): Promise<LogEntry> {
    const payload = {
      id: record.id, user_id: this.userId, date: record.date, time: record.time, title: record.title ?? '', body: record.body,
      type: record.type, tags: record.tags,
    };
    const result = await this.client.from('logs').upsert({ ...payload, deleted_at: null }, { onConflict: 'user_id,id' }).select('*').single();
    if (result.error && isMissingDeletedAtColumn(result.error)) {
      const fallback = await this.client.from('logs').upsert(payload, { onConflict: 'user_id,id' }).select('*').single();
      if (fallback.error) throw fallback.error;
      return this.toLogEntry(fallback.data as LogRow);
    }
    const { data, error } = result;
    if (error) throw error;
    return this.toLogEntry(data as LogRow);
  }

  async deleteLog(id: string): Promise<LogEntry | undefined> {
    const result = await this.client.from('logs').update({ deleted_at: new Date(0).toISOString() })
      .eq('user_id', this.userId).eq('id', id).select('*').maybeSingle();
    if (result.error && isMissingDeletedAtColumn(result.error)) {
      const fallback = await this.client.from('logs').delete().eq('user_id', this.userId).eq('id', id);
      if (fallback.error) throw fallback.error;
      return undefined;
    }
    const { data, error } = result;
    if (error) throw error;
    return data ? this.toLogEntry(data as LogRow) : undefined;
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
