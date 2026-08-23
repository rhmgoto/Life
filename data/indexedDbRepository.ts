import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';
import type { LogRepository } from './logRepository';
import { createSeedData } from './seed';

const DB_NAME = 'mylog';
const STORE_NAME = 'records';
const DATA_KEY = 'app-data-v1';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const newId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

export class IndexedDbLogRepository implements LogRepository {
  private dbPromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private async read(): Promise<AppData> {
    const db = await this.open();
    const value = await new Promise<AppData | undefined>((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DATA_KEY);
      request.onsuccess = () => resolve(request.result as AppData | undefined);
      request.onerror = () => reject(request.error);
    });
    if (value) return clone(value);
    const seed = createSeedData();
    await this.write(seed);
    return clone(seed);
  }

  private async write(data: AppData): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(clone(data), DATA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  getAll(): Promise<AppData> { return this.read(); }

  async saveLog(draft: LogDraft, id?: string): Promise<LogEntry> {
    const data = await this.read();
    const existing = data.logs.find((item) => item.id === id);
    const now = new Date().toISOString();
    const record: LogEntry = { ...draft, id: existing?.id ?? newId('log'), createdAt: existing?.createdAt ?? now, updatedAt: now };
    data.logs = existing ? data.logs.map((item) => item.id === id ? record : item) : [...data.logs, record];
    await this.write(data);
    return record;
  }

  async deleteLog(id: string): Promise<void> {
    const data = await this.read();
    data.logs = data.logs.filter((item) => item.id !== id);
    await this.write(data);
  }

  async saveEvent(draft: EventDraft, id?: string): Promise<ScheduleEvent> {
    const data = await this.read();
    const existing = data.events.find((item) => item.id === id);
    const now = new Date().toISOString();
    const record: ScheduleEvent = { ...draft, id: existing?.id ?? newId('event'), source: existing?.source ?? 'local', externalId: existing?.externalId, calendarId: existing?.calendarId, createdAt: existing?.createdAt ?? now, updatedAt: now };
    data.events = existing ? data.events.map((item) => item.id === id ? record : item) : [...data.events, record];
    await this.write(data);
    return record;
  }

  async deleteEvent(id: string): Promise<void> {
    const data = await this.read();
    data.events = data.events.filter((item) => item.id !== id);
    await this.write(data);
  }
}
