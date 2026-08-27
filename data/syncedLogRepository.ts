import type { CloudDataStore } from '@/data/cloudDataStore';
import { IndexedDbLogRepository, type PendingChange } from '@/data/indexedDbRepository';
import type { LogRepository } from '@/data/logRepository';
import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';

export type SyncState = 'syncing' | 'synced' | 'offline';

const mergeRecords = <T extends { id: string; updatedAt: string }>(left: T[], right: T[]): T[] => {
  const records = new Map(left.map((item) => [item.id, item]));
  right.forEach((item) => {
    const previous = records.get(item.id);
    if (!previous || item.updatedAt > previous.updatedAt) records.set(item.id, item);
  });
  return [...records.values()];
};

const isSeedRecord = (item: { id: string; createdAt: string; updatedAt: string }): boolean =>
  item.id.startsWith('seed-') && item.createdAt === item.updatedAt;

const userData = (data: AppData): AppData => ({
  logs: data.logs.filter((item) => !isSeedRecord(item)),
  events: data.events.filter((item) => !isSeedRecord(item)),
});

const hasUserData = (data: AppData): boolean => {
  const useful = userData(data);
  return useful.logs.length > 0 || useful.events.length > 0;
};

export class SyncedLogRepository implements LogRepository {
  private flushPromise?: Promise<void>;
  private readonly migrationKey: string;

  constructor(
    private local: IndexedDbLogRepository,
    private cloud: CloudDataStore,
    userId: string,
    private onStateChange: (state: SyncState) => void,
  ) {
    this.migrationKey = `cloud-migration-v1:${userId}`;
  }

  async getAll(): Promise<AppData> {
    this.onStateChange('syncing');
    try {
      const migrated = await this.local.getMetadata(this.migrationKey);
      if (!migrated) return await this.migrateLocalData();
      await this.flush();
      const [localData, cloudData] = await Promise.all([this.local.getAll(), this.cloud.getAll()]);
      if (hasUserData(localData)) await this.local.createRecoverySnapshot('before-cloud-sync', localData);
      if (hasUserData(localData) && !hasUserData(cloudData)) {
        await this.uploadAll(userData(localData));
        this.onStateChange('synced');
        return localData;
      }
      const merged = {
        logs: mergeRecords(localData.logs, cloudData.logs),
        events: mergeRecords(localData.events, cloudData.events),
      };
      await this.uploadAll(merged);
      await this.local.replaceAll(merged);
      this.onStateChange('synced');
      return merged;
    } catch {
      this.onStateChange('offline');
      return this.local.getAll();
    }
  }

  private async migrateLocalData(): Promise<AppData> {
    const [localData, cloudData] = await Promise.all([this.local.getAll(), this.cloud.getAll()]);
    if (hasUserData(localData)) await this.local.createRecoverySnapshot('before-initial-cloud-migration', localData);
    // 新しい端末で自動生成された未編集の見本データは、クラウドへ持ち込まない。
    const localUserData = userData(localData);
    const merged = {
      logs: mergeRecords(cloudData.logs, localUserData.logs),
      events: mergeRecords(cloudData.events, localUserData.events),
    };
    await this.uploadAll(merged);
    await this.local.replaceAll(merged);
    await this.local.setMetadata(this.migrationKey, new Date().toISOString());
    this.onStateChange('synced');
    return merged;
  }

  private async uploadAll(data: AppData): Promise<void> {
    const uploadData = userData(data);
    await Promise.all([
      ...uploadData.logs.map((record) => this.cloud.upsertLog(record)),
      ...uploadData.events.map((record) => this.cloud.upsertEvent(record)),
    ]);
  }

  async importData(data: AppData): Promise<void> {
    await this.local.importData(data);
    const merged = await this.local.getAll();
    await Promise.all([
      ...data.logs.map((record) => this.queue({ id: `log:${record.id}`, entity: 'log', action: 'upsert', record, queuedAt: new Date().toISOString() })),
      ...data.events.map((record) => this.queue({ id: `event:${record.id}`, entity: 'event', action: 'upsert', record, queuedAt: new Date().toISOString() })),
    ]);
    await this.tryFlush();
    await this.local.replaceAll(merged);
  }

  createDailyRecoverySnapshot() {
    return this.local.createDailyRecoverySnapshot();
  }

  getRecoverySnapshots() {
    return this.local.getRecoverySnapshots();
  }

  async restoreRecoverySnapshot(id: string): Promise<AppData> {
    const restored = await this.local.restoreRecoverySnapshot(id);
    await Promise.all([
      ...restored.logs.map((record) => this.queue({ id: `log:${record.id}`, entity: 'log', action: 'upsert', record, queuedAt: new Date().toISOString() })),
      ...restored.events.map((record) => this.queue({ id: `event:${record.id}`, entity: 'event', action: 'upsert', record, queuedAt: new Date().toISOString() })),
    ]);
    await this.tryFlush();
    return restored;
  }

  async saveLog(draft: LogDraft, id?: string): Promise<LogEntry> {
    const record = await this.local.saveLog(draft, id);
    await this.queue({ id: `log:${record.id}`, entity: 'log', action: 'upsert', record, queuedAt: new Date().toISOString() });
    await this.tryFlush();
    return record;
  }

  async deleteLog(id: string): Promise<void> {
    await this.local.deleteLog(id);
    await this.queue({ id: `log:${id}`, entity: 'log', action: 'delete', recordId: id, queuedAt: new Date().toISOString() });
    await this.tryFlush();
  }

  async saveEvent(draft: EventDraft, id?: string): Promise<ScheduleEvent> {
    const record = await this.local.saveEvent(draft, id);
    await this.queue({ id: `event:${record.id}`, entity: 'event', action: 'upsert', record, queuedAt: new Date().toISOString() });
    await this.tryFlush();
    return record;
  }

  async deleteEvent(id: string): Promise<void> {
    await this.local.deleteEvent(id);
    await this.queue({ id: `event:${id}`, entity: 'event', action: 'delete', recordId: id, queuedAt: new Date().toISOString() });
    await this.tryFlush();
  }

  private queue(change: PendingChange): Promise<void> {
    return this.local.putPendingChange(change);
  }

  private async tryFlush(): Promise<void> {
    this.onStateChange('syncing');
    try {
      await this.flush();
      this.onStateChange('synced');
    } catch {
      this.onStateChange('offline');
    }
  }

  private flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.flushPending().finally(() => { this.flushPromise = undefined; });
    return this.flushPromise;
  }

  private async flushPending(): Promise<void> {
    const changes = (await this.local.getPendingChanges()).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
    for (const change of changes) {
      if (change.entity === 'log' && change.action === 'upsert') await this.cloud.upsertLog(change.record);
      if (change.entity === 'log' && change.action === 'delete') await this.cloud.deleteLog(change.recordId);
      if (change.entity === 'event' && change.action === 'upsert') await this.cloud.upsertEvent(change.record);
      if (change.entity === 'event' && change.action === 'delete') await this.cloud.deleteEvent(change.recordId);
      await this.local.deletePendingChange(change.id);
    }
  }
}
