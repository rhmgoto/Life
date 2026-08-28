import type { CloudDataStore } from '@/data/cloudDataStore';
import { IndexedDbLogRepository, type PendingChange } from '@/data/indexedDbRepository';
import type { LogRepository } from '@/data/logRepository';
import type { AppData, EventDraft, LogDraft, LogEntry, ScheduleEvent } from '@/domain/models';

export type SyncState = 'syncing' | 'synced' | 'offline';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt?: string;
  error?: string;
}

const errorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'クラウドと通信できませんでした。';
};

export class SyncedLogRepository implements LogRepository {
  private flushPromise?: Promise<void>;
  private lastSyncedAt?: string;

  constructor(
    private local: IndexedDbLogRepository,
    private cloud: CloudDataStore,
    _userId: string,
    private onStatusChange: (status: SyncStatus) => void,
  ) {}

  private async report(state: SyncState, error?: string): Promise<void> {
    this.onStatusChange({
      state,
      pendingCount: (await this.local.getPendingChanges()).length,
      lastSyncedAt: this.lastSyncedAt,
      error,
    });
  }

  async getAll(): Promise<AppData> {
    await this.report('syncing');
    try {
      await this.flush();
      const cloudData = await this.cloud.getAll();
      const localData = await this.local.getAll();
      if (localData.logs.some((log) => !log.deletedAt)) {
        await this.local.createRecoverySnapshot('before-cloud-sync', localData);
      }
      // クラウドを正本とし、送信待ちキューにある変更だけをアップロードする。
      await this.local.replaceAll(cloudData);
      this.lastSyncedAt = new Date().toISOString();
      await this.report('synced');
      return cloudData;
    } catch (error) {
      await this.report('offline', errorMessage(error));
      return this.local.getAll();
    }
  }

  async importData(data: AppData): Promise<void> {
    await this.local.importData(data);
    await Promise.all([
      ...data.logs.map((record) => record.deletedAt
        ? this.queue({ id: `log:${record.id}`, entity: 'log', action: 'delete', recordId: record.id, queuedAt: new Date().toISOString() })
        : this.queue({ id: `log:${record.id}`, entity: 'log', action: 'upsert', record, queuedAt: new Date().toISOString() })),
      ...data.events.map((record) => this.queue({ id: `event:${record.id}`, entity: 'event', action: 'upsert', record, queuedAt: new Date().toISOString() })),
    ]);
    await this.tryFlush();
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
      ...restored.logs.map((record) => record.deletedAt
        ? this.queue({ id: `log:${record.id}`, entity: 'log', action: 'delete', recordId: record.id, queuedAt: new Date().toISOString() })
        : this.queue({ id: `log:${record.id}`, entity: 'log', action: 'upsert', record, queuedAt: new Date().toISOString() })),
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
    await this.report('syncing');
    try {
      await this.flush();
      this.lastSyncedAt = new Date().toISOString();
      await this.report('synced');
    } catch (error) {
      await this.report('offline', errorMessage(error));
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
      // 予定機能は廃止済み。古い送信待ち予定はクラウド同期の成否に影響させない。
      await this.local.deletePendingChange(change.id);
    }
  }
}
