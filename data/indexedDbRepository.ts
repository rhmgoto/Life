import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';
import { normalizeLogType } from '@/domain/models';
import type { LogRepository } from './logRepository';
import { createSeedData } from './seed';

const DB_NAME = 'mylog';
const STORE_NAME = 'records';
const QUEUE_STORE_NAME = 'sync-queue';
const META_STORE_NAME = 'metadata';
const DATA_KEY = 'app-data-v1';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const newId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;
const normalizeData = (data: AppData): AppData => ({
  logs: data.logs.map((log) => ({
    ...log,
    title: typeof log.title === 'string' && log.title.trim() ? log.title.trim() : undefined,
    type: normalizeLogType(log.type),
  })),
  events: data.events,
});

export class IndexedDbLogRepository implements LogRepository {
  private dbPromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        if (!request.result.objectStoreNames.contains(QUEUE_STORE_NAME)) request.result.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id' });
        if (!request.result.objectStoreNames.contains(META_STORE_NAME)) request.result.createObjectStore(META_STORE_NAME);
      };
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
    if (value) return normalizeData(clone(value));
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

  async importData(imported: AppData): Promise<void> {
    const current = await this.read();
    const merge = <T extends { id: string; updatedAt: string }>(existing: T[], incoming: T[]): T[] => {
      const records = new Map(existing.map((item) => [item.id, item]));
      incoming.forEach((item) => {
        const previous = records.get(item.id);
        if (!previous || item.updatedAt >= previous.updatedAt) records.set(item.id, clone(item));
      });
      return [...records.values()];
    };
    await this.write(normalizeData({ logs: merge(current.logs, imported.logs), events: merge(current.events, imported.events) }));
  }

  replaceAll(data: AppData): Promise<void> { return this.write(normalizeData(data)); }

  async getPendingChanges(): Promise<PendingChange[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(QUEUE_STORE_NAME).objectStore(QUEUE_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as PendingChange[]);
      request.onerror = () => reject(request.error);
    });
  }

  async putPendingChange(change: PendingChange): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
      tx.objectStore(QUEUE_STORE_NAME).put(clone(change));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deletePendingChange(id: string): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
      tx.objectStore(QUEUE_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMetadata(key: string): Promise<string | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(META_STORE_NAME).objectStore(META_STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async setMetadata(key: string, value: string): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE_NAME, 'readwrite');
      tx.objectStore(META_STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

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

export type PendingChange =
  | { id: string; entity: 'log'; action: 'upsert'; record: LogEntry; queuedAt: string }
  | { id: string; entity: 'log'; action: 'delete'; recordId: string; queuedAt: string }
  | { id: string; entity: 'event'; action: 'upsert'; record: ScheduleEvent; queuedAt: string }
  | { id: string; entity: 'event'; action: 'delete'; recordId: string; queuedAt: string };
