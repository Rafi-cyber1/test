import { appStorage } from '../db/appStorage';
import { db } from '../db/storage';

/**
 * Optional cloud sync against the Vercel serverless endpoint in `api/sync.ts`.
 *
 * Design notes
 * - The sync key is NOT compiled into the bundle: the receptionist types it once
 *   in Settings and it is kept in this browser's storage.
 * - Uploads are manual ("Upload to cloud") and downloads are always confirmed,
 *   so nothing can silently overwrite the live desk data.
 * - The payload is the exact same full-backup JSON the app already exports.
 */

const SYNC_KEY_STORAGE = 'tgt_cloud_sync_key';
const LAST_SYNC_STORAGE = 'tgt_cloud_sync_last';

export const CLOUD_SYNC_ENDPOINT = '/api/sync';

export type CloudStatus = {
  configured: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  empty: boolean;
};

export type CloudResult = {
  success: boolean;
  message: string;
  conflict?: boolean;
  counts?: Record<string, number>;
};

export const getSyncKey = (): string => appStorage.getItem(SYNC_KEY_STORAGE) || '';

export const setSyncKey = (key: string): void => {
  const trimmed = key.trim();
  if (trimmed) appStorage.setItem(SYNC_KEY_STORAGE, trimmed);
  else appStorage.removeItem(SYNC_KEY_STORAGE);
};

export const getLastSyncLabel = (): string | null => {
  const raw = appStorage.getItem(LAST_SYNC_STORAGE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { at: string; action: string; version: number };
    const when = new Date(parsed.at);
    return `${parsed.action} · v${parsed.version} · ${when.toLocaleString()}`;
  } catch {
    return null;
  }
};

const rememberSync = (action: string, version: number) => {
  appStorage.setItem(
    LAST_SYNC_STORAGE,
    JSON.stringify({ at: new Date().toISOString(), action, version })
  );
};

const request = async (method: 'GET' | 'POST', body?: unknown) => {
  const key = getSyncKey();
  if (!key) {
    throw new Error('Cloud sync key is empty — enter the sync key from Vercel first.');
  }

  const response = await fetch(CLOUD_SYNC_ENDPOINT, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-sync-key': key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Cloud sync endpoint not found. It only runs on Vercel (or with `vercel dev`) — the static preview has no /api functions.'
    );
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error: any = new Error(payload?.error || `Cloud sync failed (${response.status}).`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

/** Builds the same payload shape as the manual full backup. */
const buildSnapshot = () => {
  const database = JSON.parse(JSON.stringify(db.getState()));

  // Keep the payload inside the free Upstash request limit: the audit trail is
  // trimmed to the most recent 400 rows (the local copy keeps everything).
  if (Array.isArray(database.auditLogs) && database.auditLogs.length > 400) {
    database.auditLogs = database.auditLogs.slice(0, 400);
  }

  return {
    exportTimestamp: new Date().toISOString(),
    software: 'The Gym Town Enterprise Desktop - Hyderabad Desk',
    version: '3.0.0',
    schemaVersion: 3,
    counts: db.getBackupCounts(),
    database,
  };
};

export const checkCloudStatus = async (): Promise<CloudStatus> => {
  const payload = await request('GET');
  return {
    configured: true,
    version: payload?.version || 0,
    updatedAt: payload?.updatedAt || null,
    updatedBy: payload?.updatedBy || null,
    empty: payload?.empty !== false,
  };
};

export const uploadToCloud = async (baseVersion: number, updatedBy: string): Promise<CloudResult> => {
  const snapshot = buildSnapshot();
  try {
    const payload = await request('POST', { baseVersion, updatedBy, snapshot });
    rememberSync('Upload', payload.version);
    const counts = snapshot.counts as Record<string, number>;
    const sizeKb = Math.round(JSON.stringify(snapshot).length / 1024);
    return {
      success: true,
      message: `Uploaded to cloud as v${payload.version} (${sizeKb} KB) — ${counts.members} members, ${counts.products} products, ${counts.payments} receipts.`,
      counts,
    };
  } catch (error: any) {
    if (error.status === 409) {
      return {
        success: false,
        conflict: true,
        message:
          'Cloud has newer data from another device. Download the cloud copy first, then upload again.',
      };
    }
    return { success: false, message: error.message || 'Upload failed.' };
  }
};

export const downloadFromCloud = async (): Promise<CloudResult> => {
  try {
    const payload = await request('GET');
    if (!payload?.snapshot) {
      return { success: false, message: 'Cloud is empty — upload from this device first.' };
    }

    const result = db.restoreBackupJson(JSON.stringify(payload.snapshot));
    if (!result.success) {
      return { success: false, message: result.message };
    }

    rememberSync('Download', payload.version || 0);
    return {
      success: true,
      message: `Cloud copy v${payload.version} restored. ${result.message}`,
    };
  } catch (error: any) {
    return { success: false, message: error.message || 'Download failed.' };
  }
};
