import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';
import { normalizeLogType } from '@/domain/models';
import type { LogRepository } from './logRepository';
import { createSeedData } from './seed';

const DB_NAME = 'mylog';
const STORE_NAME = 'records';
const QUEUE_STORE_NAME = 'sync-queue';
const META_STORE_NAME = 'metadata';
const DATA_KEY = 'app-data-v1';
const RECOVERY_SNAPSHOTS_KEY = 'recovery-snapshots-v1';
const DAILY_RECOVERY_SNAPSHOT_DATE_KEY = 'daily-recovery-snapshot-date-v1';
const SHADOW_DATA_KEY = 'mylog:last-known-good-data-v1';
const SHADOW_RECOVERY_SNAPSHOTS_KEY = 'mylog:recovery-snapshots-v1';
const MAX_RECOVERY_SNAPSHOTS = 5;
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

const isSeedRecord = (item: { id: string; createdAt: string; updatedAt: string }): boolean =>
  item.id.startsWith('seed-') && item.createdAt === item.updatedAt;

const hasUserData = (data: AppData): boolean =>
  data.logs.some((item) => !isSeedRecord(item)) || data.events.some((item) => !isSeedRecord(item));

const readLocalStorage = (key: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

const writeLocalStorage = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // IndexedDB is still the primary store; localStorage is a best-effort safety mirror.
  }
};

const readJson = <T,>(raw: string | undefined): T | undefined => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

export type RecoverySnapshot = {
  id: string;
  reason: string;
  createdAt: string;
  logCount: number;
  eventCount: number;
  data: AppData;
};

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
    const shadow = this.readShadowData();
    if (shadow) {
      await this.write(shadow);
      return clone(shadow);
    }
    const seed = createSeedData();
    await this.write(seed);
    return clone(seed);
  }

  private async write(data: AppData): Promise<void> {
    const normalized = normalizeData(data);
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(clone(normalized), DATA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.writeShadowData(normalized);
  }

  private readShadowData(): AppData | undefined {
    const data = readJson<AppData>(readLocalStorage(SHADOW_DATA_KEY));
    if (!data) return undefined;
    const normalized = normalizeData(data);
    return hasUserData(normalized) ? normalized : undefined;
  }

  private writeShadowData(data: AppData): void {
    const normalized = normalizeData(data);
    if (!hasUserData(normalized)) return;
    writeLocalStorage(SHADOW_DATA_KEY, JSON.stringify(normalized));
  }

  getAll(): Promise<AppData> { return this.read(); }

  async importData(imported: AppData): Promise<void> {
    await this.createRecoverySnapshot('before-backup-import');
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

  private normalizeRecoverySnapshots(snapshots: RecoverySnapshot[]): RecoverySnapshot[] {
    return snapshots
      .filter((snapshot) => snapshot.id && snapshot.createdAt && snapshot.data)
      .map((snapshot) => ({ ...snapshot, data: normalizeData(snapshot.data) }))
      .filter((snapshot) => hasUserData(snapshot.data))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_RECOVERY_SNAPSHOTS);
  }

  private readShadowRecoverySnapshots(): RecoverySnapshot[] {
    const snapshots = readJson<RecoverySnapshot[]>(readLocalStorage(SHADOW_RECOVERY_SNAPSHOTS_KEY));
    if (!Array.isArray(snapshots)) return [];
    return this.normalizeRecoverySnapshots(snapshots);
  }

  private writeShadowRecoverySnapshots(snapshots: RecoverySnapshot[]): void {
    writeLocalStorage(SHADOW_RECOVERY_SNAPSHOTS_KEY, JSON.stringify(this.normalizeRecoverySnapshots(snapshots)));
  }

  private mergeRecoverySnapshots(left: RecoverySnapshot[], right: RecoverySnapshot[]): RecoverySnapshot[] {
    const snapshots = new Map<string, RecoverySnapshot>();
    [...left, ...right].forEach((snapshot) => snapshots.set(snapshot.id, snapshot));
    return this.normalizeRecoverySnapshots([...snapshots.values()]);
  }

  private async readIndexedRecoverySnapshots(): Promise<RecoverySnapshot[]> {
    const raw = await this.getMetadata(RECOVERY_SNAPSHOTS_KEY);
    if (!raw) return [];
    try {
      const snapshots = JSON.parse(raw) as RecoverySnapshot[];
      if (!Array.isArray(snapshots)) return [];
      return this.normalizeRecoverySnapshots(snapshots);
    } catch {
      return [];
    }
  }

  private async readRecoverySnapshots(): Promise<RecoverySnapshot[]> {
    const snapshots = this.mergeRecoverySnapshots(await this.readIndexedRecoverySnapshots(), this.readShadowRecoverySnapshots());
    if (snapshots.length) await this.setMetadata(RECOVERY_SNAPSHOTS_KEY, JSON.stringify(snapshots));
    this.writeShadowRecoverySnapshots(snapshots);
    return snapshots;
  }

  async createRecoverySnapshot(reason: string, data?: AppData): Promise<void> {
    const snapshotData = normalizeData(data ? clone(data) : await this.read());
    if (!hasUserData(snapshotData)) return;
    const current = await this.readRecoverySnapshots();
    const snapshot: RecoverySnapshot = {
      id: `snapshot-${Date.now()}`,
      reason,
      createdAt: new Date().toISOString(),
      logCount: snapshotData.logs.length,
      eventCount: snapshotData.events.length,
      data: snapshotData,
    };
    const snapshots = this.normalizeRecoverySnapshots([snapshot, ...current]);
    await this.setMetadata(RECOVERY_SNAPSHOTS_KEY, JSON.stringify(snapshots));
    this.writeShadowRecoverySnapshots(snapshots);
    this.writeShadowData(snapshotData);
  }

  async createDailyRecoverySnapshot(): Promise<boolean> {
    const today = new Date().toLocaleDateString('sv-SE');
    if (await this.getMetadata(DAILY_RECOVERY_SNAPSHOT_DATE_KEY) === today) return false;
    const data = await this.read();
    if (!hasUserData(data)) return false;
    await this.createRecoverySnapshot('daily-startup', data);
    await this.setMetadata(DAILY_RECOVERY_SNAPSHOT_DATE_KEY, today);
    return true;
  }

  async getRecoverySnapshots(): Promise<RecoverySnapshot[]> {
    return this.readRecoverySnapshots();
  }

  async restoreRecoverySnapshot(id: string): Promise<AppData> {
    const snapshots = await this.readRecoverySnapshots();
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) throw new Error('復旧スナップショットが見つかりません。');
    await this.createRecoverySnapshot('before-snapshot-restore');
    await this.write(snapshot.data);
    return normalizeData(clone(snapshot.data));
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
    await this.createRecoverySnapshot('before-log-delete');
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
