import type { AppData } from '@/domain/models';

interface BackupFile {
  app: 'MyLog';
  version: 1;
  exportedAt: string;
  reason: string;
  data: AppData;
}

export interface LocalFileBackupStatus {
  available: boolean;
  connected: boolean;
  folderName?: string;
  lastBackupAt?: string;
}

const DB_NAME = 'mylog-file-backup';
const STORE_NAME = 'handles';
const DIRECTORY_HANDLE_KEY = 'backup-directory';
const LAST_BACKUP_DATE_KEY = 'mylog:file-backup-last-date-v1';
const LAST_BACKUP_AT_KEY = 'mylog:file-backup-last-at-v1';

type PermissionMode = 'read' | 'readwrite';
type FileSystemPermissionDescriptor = { mode?: PermissionMode };

interface WritableFileStream {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileHandle {
  createWritable(): Promise<WritableFileStream>;
}

interface DirectoryHandle {
  name: string;
  queryPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<DirectoryHandle>;
  }
}

const hasUserData = (data: AppData): boolean => data.logs.length > 0 || data.events.length > 0;

const todayKey = () => new Date().toLocaleDateString('sv-SE');

const backupFileName = (date = new Date()): string => {
  const stamp = date.toLocaleString('sv-SE').replace(' ', 'T').replaceAll(':', '-');
  return `mylog-auto-backup-${stamp}.json`;
};

const buildBackup = (data: AppData, reason: string): BackupFile => ({
  app: 'MyLog',
  version: 1,
  exportedAt: new Date().toISOString(),
  reason,
  data,
});

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const getStoredHandle = async (): Promise<DirectoryHandle | undefined> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DIRECTORY_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result as DirectoryHandle | undefined);
    request.onerror = () => reject(request.error);
  });
};

const setStoredHandle = async (handle: DirectoryHandle): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, DIRECTORY_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const canWrite = async (handle: DirectoryHandle, prompt: boolean): Promise<boolean> => {
  const descriptor = { mode: 'readwrite' as const };
  if (await handle.queryPermission?.(descriptor) === 'granted') return true;
  if (!prompt) return false;
  return await handle.requestPermission?.(descriptor) === 'granted';
};

const writeBackup = async (handle: DirectoryHandle, data: AppData, reason: string): Promise<string> => {
  const fileName = backupFileName();
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(buildBackup(data, reason), null, 2));
  await writable.close();
  window.localStorage.setItem(LAST_BACKUP_DATE_KEY, todayKey());
  window.localStorage.setItem(LAST_BACKUP_AT_KEY, new Date().toISOString());
  return fileName;
};

export const isLocalFileBackupAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function getLocalFileBackupStatus(): Promise<LocalFileBackupStatus> {
  if (!isLocalFileBackupAvailable()) return { available: false, connected: false };
  const handle = await getStoredHandle();
  if (!handle) return { available: true, connected: false };
  return {
    available: true,
    connected: await canWrite(handle, false),
    folderName: handle.name,
    lastBackupAt: window.localStorage.getItem(LAST_BACKUP_AT_KEY) ?? undefined,
  };
}

export async function chooseLocalFileBackupFolder(data: AppData): Promise<LocalFileBackupStatus> {
  if (!isLocalFileBackupAvailable() || !window.showDirectoryPicker) throw new Error('このブラウザではフォルダへの自動保存に対応していません。');
  const handle = await window.showDirectoryPicker();
  await setStoredHandle(handle);
  if (!await canWrite(handle, true)) throw new Error('フォルダへの書き込みが許可されませんでした。');
  if (hasUserData(data)) await writeBackup(handle, data, 'folder-selected');
  return getLocalFileBackupStatus();
}

export async function writeLocalFileBackupNow(data: AppData): Promise<string> {
  const handle = await getStoredHandle();
  if (!handle) throw new Error('先に保存先フォルダを選んでください。');
  if (!await canWrite(handle, true)) throw new Error('フォルダへの書き込みが許可されませんでした。');
  return writeBackup(handle, data, 'manual');
}

export async function tryDailyLocalFileBackup(data: AppData): Promise<boolean> {
  if (!isLocalFileBackupAvailable() || !hasUserData(data)) return false;
  if (window.localStorage.getItem(LAST_BACKUP_DATE_KEY) === todayKey()) return false;
  const handle = await getStoredHandle();
  if (!handle || !await canWrite(handle, false)) return false;
  await writeBackup(handle, data, 'daily-startup');
  return true;
}
