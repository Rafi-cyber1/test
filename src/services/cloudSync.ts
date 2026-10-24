import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type CloudStatus = 'local-only' | 'connecting' | 'synced' | 'syncing' | 'error';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const url = viteEnv?.VITE_SUPABASE_URL;
const anonKey = viteEnv?.VITE_SUPABASE_ANON_KEY;
const validConfiguration = Boolean(
  url && anonKey && !url.includes('YOUR_PROJECT_REF') && !anonKey.includes('YOUR_SUPABASE_')
);

export const cloudConfigured = validConfiguration;
let supabase: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

const getSupabase = async (): Promise<SupabaseClient | null> => {
  if (!validConfiguration) return null;
  if (supabase) return supabase;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      supabase = createClient(url!, anonKey!, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      return supabase;
    });
  }
  return clientPromise;
};

export interface CloudSnapshot {
  snapshot: Record<string, unknown>;
  revision: number;
  updatedAt: string;
}

let activeUserId: string | null = null;
let currentRevision = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let latestSnapshot: Record<string, unknown> | null = null;
let saveChain = Promise.resolve();
let syncStatus: CloudStatus = cloudConfigured ? 'connecting' : 'local-only';
const statusListeners = new Set<(status: CloudStatus) => void>();

const setStatus = (status: CloudStatus) => {
  syncStatus = status;
  statusListeners.forEach((listener) => listener(status));
};

export const getCloudStatus = (): CloudStatus => syncStatus;

export const subscribeCloudStatus = (listener: (status: CloudStatus) => void) => {
  statusListeners.add(listener);
  listener(syncStatus);
  return () => { statusListeners.delete(listener); };
};

export const cloudSnapshotKey = 'tgt_cloud_last_synced_snapshot';

export const readLastSyncedSnapshot = (): string | null => {
  try {
    return localStorage.getItem(cloudSnapshotKey);
  } catch {
    return null;
  }
};

export const markSynced = (snapshot: Record<string, unknown>) => {
  try {
    localStorage.setItem(cloudSnapshotKey, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Could not record the last cloud sync marker.', error);
  }
};

export const subscribeToCloudAuth = async (
  listener: (event: string, session: Session | null) => void
): Promise<() => void> => {
  const client = await getSupabase();
  if (!client) return () => undefined;
  const { data } = client.auth.onAuthStateChange((event, session) => listener(event, session));
  return () => data.subscription.unsubscribe();
};

export const getCurrentSession = async (): Promise<Session | null> => {
  const client = await getSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const signInToCloud = async (email: string, password: string): Promise<Session> => {
  const client = await getSupabase();
  if (!client) throw new Error('Cloud sync is not configured.');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('Sign-in did not return a session.');
  return data.session;
};

export const sendPasswordRecovery = async (email: string): Promise<void> => {
  const client = await getSupabase();
  if (!client) throw new Error('Cloud sync is not configured.');
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  if (error) throw error;
};

export const updateCloudPassword = async (password: string): Promise<Session> => {
  const client = await getSupabase();
  if (!client) throw new Error('Cloud sync is not configured.');
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  const session = await getCurrentSession();
  if (!session) throw new Error('Your reset session expired. Request another recovery email.');
  return session;
};

export const signOutOfCloud = async (): Promise<void> => {
  const client = await getSupabase();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
  activeUserId = null;
  currentRevision = 0;
  latestSnapshot = null;
  if (saveTimer) clearTimeout(saveTimer);
  setStatus('connecting');
};

export const loadCloudSnapshot = async (userId: string): Promise<CloudSnapshot | null> => {
  const client = await getSupabase();
  if (!client) throw new Error('Cloud sync is not configured.');
  setStatus('connecting');
  const { data, error } = await client
    .from('gym_app_state')
    .select('snapshot, revision, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    snapshot: data.snapshot as Record<string, unknown>,
    revision: Number(data.revision),
    updatedAt: data.updated_at,
  };
};

export const startCloudSync = (userId: string, revision: number) => {
  activeUserId = userId;
  currentRevision = revision;
  setStatus('synced');
};

export const saveCloudSnapshot = async (
  snapshot: Record<string, unknown>,
  expectedRevision: number
): Promise<number> => {
  const client = await getSupabase();
  if (!client) throw new Error('Cloud sync is not configured.');
  const { data, error } = await client.rpc('write_gym_app_state', {
    p_snapshot: snapshot,
    p_expected_revision: expectedRevision,
  });
  if (error) throw error;
  const revision = Number(data);
  if (!Number.isFinite(revision) || revision < 1) {
    throw new Error('Supabase returned an invalid snapshot revision.');
  }
  return revision;
};

const flushLatestSnapshot = async () => {
  if (!activeUserId || !latestSnapshot) return;
  const snapshot = latestSnapshot;
  setStatus('syncing');
  saveChain = saveChain.then(async () => {
    if (!activeUserId) return;
    const nextRevision = await saveCloudSnapshot(snapshot, currentRevision);
    currentRevision = nextRevision;
    markSynced(snapshot);
    if (latestSnapshot === snapshot) setStatus('synced');
    else void flushLatestSnapshot();
  }).catch((error: unknown) => {
    console.error('Cloud sync failed. The local copy remains saved.', error);
    setStatus('error');
  });
  await saveChain;
};

export const queueCloudSnapshot = (snapshot: Record<string, unknown>) => {
  if (!activeUserId) return;
  latestSnapshot = snapshot;
  setStatus('syncing');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushLatestSnapshot(), 500);
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (activeUserId && latestSnapshot && syncStatus === 'error') void flushLatestSnapshot();
  });
}
