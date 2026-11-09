import { appStorage } from '../db/appStorage';
import { db } from '../db/storage';
import { getSyncKey, pullCloudRaw, pushCloudRaw } from './cloudSync';

/**
 * Background auto-sync for the Vercel `/api/sync` endpoint.
 *
 * What it does, in order:
 *   1. On start, reads the cloud version.
 *      - cloud empty            → upload this device's data (first desk wins)
 *      - cloud has data, local empty → download it (a brand-new phone / laptop)
 *      - both have data         → ask (status = 'needs-choice'), never guess
 *   2. After that, every local change is pushed ~2 s later (debounced).
 *   3. Every 25 s (only while the tab is visible) it checks the cloud version;
 *      if another desk saved something newer, it pulls it in.
 *   4. Nothing is ever silently destroyed: before adopting remote data the
 *      previous local copy is kept by `restoreBackupJson` as a pre-restore
 *      snapshot, and a version conflict parks the engine in 'conflict' instead
 *      of overwriting the other desk.
 *
 * The engine is inert unless a sync key is configured in Settings.
 */

const VERSION_STORAGE = 'tgt_cloud_version';
const MODE_STORAGE = 'tgt_cloud_mode'; // 'auto' | 'manual'

export type AutoSyncStatus =
  | 'disabled'      // no sync key on this device
  | 'idle'          // enabled, waiting for the first check
  | 'checking'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'conflict'      // another desk saved newer data; user must press Download
  | 'needs-choice'  // both sides have data; user must pick Upload or Download
  | 'error';

export interface AutoSyncState {
  status: AutoSyncStatus;
  version: number;
  lastSyncAt: string | null;
  message: string;
  auto: boolean;
}

const PUSH_DEBOUNCE_MS = 2000;
const POLL_MS = 25000;

class CloudAutoSync {
  private state: AutoSyncState = {
    status: 'disabled',
    version: 0,
    lastSyncAt: null,
    message: '',
    auto: true,
  };

  private listeners = new Set<() => void>();
  private started = false;
  private applyingRemote = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private unsubscribeDb: (() => void) | null = null;

  public getState(): AutoSyncState {
    return this.state;
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<AutoSyncState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private get storedVersion(): number {
    const raw = appStorage.getItem(VERSION_STORAGE);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private set storedVersion(version: number) {
    appStorage.setItem(VERSION_STORAGE, String(version));
  }

  public isAuto(): boolean {
    return appStorage.getItem(MODE_STORAGE) !== 'manual';
  }

  public setAuto(enabled: boolean): void {
    appStorage.setItem(MODE_STORAGE, enabled ? 'auto' : 'manual');
    this.set({ auto: enabled });
    if (enabled) void this.bootstrap();
  }

  /** True when this browser already holds real gym data. */
  private hasLocalData(): boolean {
    const state = db.getState();
    return (
      state.members.length > 0 ||
      state.payments.length > 0 ||
      state.memberFeeLedger.length > 0 ||
      state.products.length > 0 ||
      state.sales.length > 0
    );
  }

  public start(): void {
    if (this.started) return;
    this.started = true;
    this.state = { ...this.state, auto: this.isAuto() };

    if (!getSyncKey()) {
      this.set({ status: 'disabled', message: 'Cloud sync key set nahi hai (Settings → Database).' });
      return;
    }

    // Push after every local mutation (debounced).
    this.unsubscribeDb = db.subscribe(() => {
      if (this.applyingRemote) return;
      if (!this.state.auto) return;
      this.schedulePush();
    });

    window.addEventListener('online', () => void this.poll(true));
    window.addEventListener('focus', () => void this.poll(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.poll(true);
    });

    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.poll(false);
    }, POLL_MS);

    void this.bootstrap();
  }

  public stop(): void {
    this.unsubscribeDb?.();
    this.unsubscribeDb = null;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pushTimer = null;
    this.pollTimer = null;
    this.started = false;
  }

  /** First connection of a device: decide who owns the data. */
  public async bootstrap(): Promise<void> {
    if (!getSyncKey()) {
      this.set({ status: 'disabled', message: 'Cloud sync key set nahi hai.' });
      return;
    }
    if (this.inFlight) return;

    this.inFlight = true;
    this.set({ status: 'checking', message: 'Cloud check ho raha hai…' });

    try {
      const remote = await pullCloudRaw();

      if (remote.empty) {
        // Cloud is empty → this device seeds it.
        const result = await pushCloudRaw(0, this.operatorName());
        this.storedVersion = result.version;
        this.set({
          status: 'synced',
          version: result.version,
          lastSyncAt: result.updatedAt,
          message: 'Cloud khaali tha — is device ka data upload kar diya.',
        });
        return;
      }

      this.set({ version: remote.version, lastSyncAt: remote.updatedAt });

      if (!this.hasLocalData()) {
        // New device → adopt the cloud copy.
        this.applyRemote(remote.snapshot, remote.version, 'Cloud se data download ho gaya.');
        return;
      }

      if (this.storedVersion > 0 && remote.version > this.storedVersion) {
        // Another desk saved something newer while we were away.
        this.applyRemote(remote.snapshot, remote.version, 'Doosre desk ka naya data mil gaya — apply kar diya.');
        return;
      }

      if (this.storedVersion === 0) {
        // Never synced before and both sides have data → the user decides.
        db.addAuditLog?.(
          'SYSTEM',
          'Cloud Sync',
          'Device connected to cloud but both sides had data — waiting for Upload/Download choice.'
        );
        this.set({
          status: 'needs-choice',
          message:
            'Cloud par bhi data hai aur is device par bhi. Settings → Cloud Sync se choose karein: Upload (ye device jeetay) ya Download (cloud jeetay).',
        });
        return;
      }

      this.set({ status: 'synced', message: 'Cloud up to date.' });
    } catch (error: any) {
      this.set({
        status: navigator.onLine === false ? 'offline' : 'error',
        message: error?.message || 'Cloud se connect nahi ho saka.',
      });
    } finally {
      this.inFlight = false;
    }
  }

  private operatorName(): string {
    try {
      return db.getSettings().receptionistProfile?.name || 'front desk';
    } catch {
      return 'front desk';
    }
  }

  private applyRemote(snapshot: unknown, version: number, message: string): void {
    this.applyingRemote = true;
    try {
      const result = db.restoreBackupJson(JSON.stringify(snapshot));
      this.storedVersion = version;
      this.set({
        status: result.success ? 'synced' : 'error',
        version,
        lastSyncAt: new Date().toISOString(),
        message: result.success ? message : result.message,
      });
    } catch (error: any) {
      this.set({ status: 'error', message: error?.message || 'Cloud data apply nahi ho saka.' });
    } finally {
      // Give the db subscriber a tick to ignore the restore it just saw.
      setTimeout(() => {
        this.applyingRemote = false;
      }, 50);
    }
  }

  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      void this.push();
    }, PUSH_DEBOUNCE_MS);
  }

  public async push(): Promise<void> {
    if (!getSyncKey() || this.inFlight) return;
    if (this.state.status === 'conflict' || this.state.status === 'needs-choice') return;

    this.inFlight = true;
    this.set({ status: 'syncing', message: 'Cloud par save ho raha hai…' });

    try {
      const result = await pushCloudRaw(this.storedVersion, this.operatorName());
      this.storedVersion = result.version;
      this.set({
        status: 'synced',
        version: result.version,
        lastSyncAt: result.updatedAt,
        message: 'Cloud par save ho gaya.',
      });
    } catch (error: any) {
      if (error?.status === 409) {
        this.set({
          status: 'conflict',
          message:
            'Doosre desk ne naya data save kiya hai. Settings → Cloud Sync → Download from cloud dabayein, phir dobara kaam karein.',
        });
      } else {
        this.set({
          status: navigator.onLine === false ? 'offline' : 'error',
          message: error?.message || 'Upload fail — data is device par safe hai, retry hoga.',
        });
      }
    } finally {
      this.inFlight = false;
    }
  }

  /** Manual "Download from cloud" that also resets the conflict state. */
  public async forceDownload(): Promise<void> {
    if (!getSyncKey()) return;
    this.set({ status: 'checking', message: 'Cloud se download…' });
    try {
      const remote = await pullCloudRaw();
      if (remote.empty || !remote.snapshot) {
        this.set({ status: 'error', message: 'Cloud khaali hai — pehle upload karein.' });
        return;
      }
      this.applyRemote(remote.snapshot, remote.version, 'Cloud copy download ho gayi.');
    } catch (error: any) {
      this.set({ status: 'error', message: error?.message || 'Download fail.' });
    }
  }

  /** Manual "Upload to cloud": takes ownership of the cloud copy. */
  public async forceUpload(): Promise<void> {
    if (!getSyncKey()) return;
    this.set({ status: 'syncing', message: 'Upload…' });
    try {
      const remote = await pullCloudRaw();
      const result = await pushCloudRaw(remote.version, this.operatorName());
      this.storedVersion = result.version;
      this.set({
        status: 'synced',
        version: result.version,
        lastSyncAt: result.updatedAt,
        message: 'Is device ka data cloud par upload ho gaya.',
      });
    } catch (error: any) {
      this.set({ status: 'error', message: error?.message || 'Upload fail.' });
    }
  }

  /** Called after the key is saved in Settings. */
  public async restart(): Promise<void> {
    this.storedVersion = 0;
    this.set({ status: 'idle', message: '' });
    await this.bootstrap();
  }

  private async poll(_force = false): Promise<void> {
    if (!getSyncKey() || this.inFlight) return;
    if (!this.state.auto) return;
    if (this.state.status === 'needs-choice' || this.state.status === 'conflict') return;

    try {
      const remote = await pullCloudRaw();
      if (remote.empty) return;
      if (remote.version > this.storedVersion) {
        this.applyRemote(remote.snapshot, remote.version, 'Doosre desk ka naya data apply ho gaya.');
      }
    } catch {
      /* silent: polling must never disturb the counter */
    }
  }
}

export const cloudAutoSync = new CloudAutoSync();
