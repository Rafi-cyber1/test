import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Cloud, CloudOff, LoaderCircle, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { db } from '../../db/storage';
import {
  cloudConfigured,
  getCloudStatus,
  getCurrentSession,
  loadCloudSnapshot,
  markSynced,
  readLastSyncedSnapshot,
  saveCloudSnapshot,
  signInToCloud,
  signOutOfCloud,
  startCloudSync,
  subscribeCloudStatus,
  type CloudSnapshot,
  type CloudStatus,
} from '../../services/cloudSync';

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

type SyncChoice = { remote: CloudSnapshot; local: Record<string, unknown> } | null;

const hasBusinessRecords = (state: Record<string, unknown>): boolean => {
  const collections = ['members', 'membershipHistory', 'memberFeeLedger', 'attendance', 'payments', 'expenses', 'doorLogs', 'sales', 'stockPurchases', 'inventoryTransactions'];
  return collections.some((key) => Array.isArray(state[key]) && (state[key] as unknown[]).length > 0);
};

const LoginScreen: React.FC<{ onLogin: (email: string, password: string) => Promise<void>; error: string; loading: boolean }> = ({ onLogin, error, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onLogin(email.trim(), password);
  };

  return (
    <main className="min-h-screen bg-[#06070B] text-[#EEF1F9] flex items-center justify-center p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#1D293F] bg-[#0B1220] p-7 shadow-2xl">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-[#263755] bg-[#15295A] text-[#C3D2FF]">
          <Cloud className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7D9DFF]">Secure cloud storage</p>
        <h1 className="mt-2 text-2xl font-bold">The Gym Town</h1>
        <p className="mt-2 text-sm text-[#8B96AE]">Sign in with the owner account created in Supabase Authentication.</p>
        <label className="mt-6 block text-sm font-medium" htmlFor="cloud-email">Email</label>
        <input id="cloud-email" autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-[#263755] bg-[#06070B] px-3 py-2.5 text-sm text-[#EEF1F9] outline-none focus:border-[#3D6BFF] focus:ring-2 focus:ring-[#3D6BFF]/40" />
        <label className="mt-4 block text-sm font-medium" htmlFor="cloud-password">Password</label>
        <input id="cloud-password" autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-[#263755] bg-[#06070B] px-3 py-2.5 text-sm text-[#EEF1F9] outline-none focus:border-[#3D6BFF] focus:ring-2 focus:ring-[#3D6BFF]/40" />
        {error && <p role="alert" className="mt-4 rounded-lg border border-[#FF6A4D]/30 bg-[#FF6A4D]/10 p-3 text-sm text-[#FF9A84]">{error}</p>}
        <button type="submit" disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3D6BFF] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#315AE0] disabled:cursor-wait disabled:opacity-60">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? 'Connecting…' : 'Sign in and sync'}
        </button>
        <p className="mt-4 text-xs leading-relaxed text-[#8B96AE]">Your gym data is private to the signed-in Supabase account. Never put a service-role key in this app.</p>
      </form>
    </main>
  );
};

const SyncBadge: React.FC<{ status: CloudStatus; email?: string; onSignOut?: () => void; localOnly?: boolean }> = ({ status, email, onSignOut, localOnly }) => {
  const icon = localOnly || status === 'error' ? <CloudOff className="h-3.5 w-3.5" /> : status === 'syncing' || status === 'connecting' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />;
  const label = localOnly ? 'Local only — cloud not configured' : status === 'syncing' ? 'Syncing…' : status === 'connecting' ? 'Connecting to cloud…' : status === 'error' ? 'Cloud sync needs attention; local copy saved' : 'Cloud synced';
  return (
    <div className="fixed bottom-3 right-3 z-[100] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-[#263755] bg-[#0B1220]/95 px-3 py-2 text-[11px] text-[#C3D2FF] shadow-xl backdrop-blur">
      {icon}<span className="truncate">{label}</span>
      {email && <span className="hidden border-l border-[#263755] pl-2 text-[#8B96AE] sm:inline">{email}</span>}
      {onSignOut && <button type="button" onClick={onSignOut} title="Sign out" aria-label="Sign out" className="ml-1 rounded-full p-1 text-[#8B96AE] hover:bg-[#15295A] hover:text-white"><LogOut className="h-3.5 w-3.5" /></button>}
    </div>
  );
};

export const CloudBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(Boolean(cloudConfigured));
  const [error, setError] = useState('');
  const [choice, setChoice] = useState<SyncChoice>(null);
  const [status, setStatus] = useState(getCloudStatus());

  useEffect(() => subscribeCloudStatus(setStatus), []);

  const activateSession = useCallback(async (activeSession: Session) => {
    setLoading(true);
    setError('');
    setChoice(null);
    try {
      const remote = await loadCloudSnapshot(activeSession.user.id);
      const local = db.getState() as unknown as Record<string, unknown>;
      const lastSynced = readLastSyncedSnapshot();
      const localJson = JSON.stringify(local);
      const remoteJson = remote ? JSON.stringify(remote.snapshot) : null;
      const hasLocalRecords = hasBusinessRecords(local);

      if (!remote) {
        const revision = await saveCloudSnapshot(local, 0);
        markSynced(local);
        startCloudSync(activeSession.user.id, revision);
        setSession(activeSession);
        setReady(true);
        return;
      }

      const localChanged = lastSynced !== null && localJson !== lastSynced;
      const remoteChanged = lastSynced !== null && remoteJson !== lastSynced;
      if (lastSynced && localJson === lastSynced) {
        db.replaceStateFromCloud(remote.snapshot);
        markSynced(remote.snapshot);
        startCloudSync(activeSession.user.id, remote.revision);
        setSession(activeSession);
        setReady(true);
        return;
      }
      if (lastSynced && remoteJson === lastSynced && localChanged) {
        const revision = await saveCloudSnapshot(local, remote.revision);
        markSynced(local);
        startCloudSync(activeSession.user.id, revision);
        setSession(activeSession);
        setReady(true);
        return;
      }
      if (hasLocalRecords && hasBusinessRecords(remote.snapshot)) {
        setChoice({ remote, local });
        setSession(activeSession);
        setLoading(false);
        return;
      }

      if (hasLocalRecords && !hasBusinessRecords(remote.snapshot)) {
        const revision = await saveCloudSnapshot(local, remote.revision);
        markSynced(local);
        startCloudSync(activeSession.user.id, revision);
      } else {
        db.replaceStateFromCloud(remote.snapshot);
        markSynced(remote.snapshot);
        startCloudSync(activeSession.user.id, remote.revision);
      }
      setSession(activeSession);
      setReady(true);
    } catch (cause) {
      console.error('Could not initialize cloud sync.', cause);
      setError(cause instanceof Error ? cause.message : 'Unable to connect to cloud storage.');
      setSession(activeSession);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cloudConfigured) return;
    let active = true;
    void getCurrentSession().then((existing) => {
      if (!active) return;
      if (existing) {
        setSession(existing);
        void activateSession(existing);
      } else {
        setLoading(false);
      }
    }).catch((cause: unknown) => {
      if (!active) return;
      setLoading(false);
      setError(cause instanceof Error ? cause.message : 'Could not read the saved Supabase session.');
    });
    return () => { active = false; };
  }, [activateSession]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const nextSession = await signInToCloud(email, password);
      await activateSession(nextSession);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Check the email and password.');
      setLoading(false);
    }
  };

  const useCloudCopy = () => {
    if (!choice || !session) return;
    try {
      db.replaceStateFromCloud(choice.remote.snapshot);
      markSynced(choice.remote.snapshot);
      startCloudSync(session.user.id, choice.remote.revision);
      setChoice(null);
      setReady(true);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the cloud copy.');
    }
  };

  const useThisDeviceCopy = async () => {
    if (!choice || !session) return;
    setLoading(true);
    setError('');
    try {
      const revision = await saveCloudSnapshot(choice.local, choice.remote.revision);
      markSynced(choice.local);
      startCloudSync(session.user.id, revision);
      setChoice(null);
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload this device’s data.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setReady(false);
    setSession(null);
    setError('');
    await signOutOfCloud();
  };

  if (!cloudConfigured) {
    return <>{children}<SyncBadge status="local-only" localOnly /></>;
  }
  if (loading && !ready) {
    return <main className="min-h-screen bg-[#06070B] text-[#C3D2FF] flex items-center justify-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin" />Connecting to secure gym storage…</main>;
  }
  if (!session) {
    return <LoginScreen onLogin={login} error={error} loading={loading} />;
  }
  if (choice && !ready) {
    return (
      <main className="min-h-screen bg-[#06070B] text-[#EEF1F9] flex items-center justify-center p-5">
        <section className="w-full max-w-xl rounded-2xl border border-[#1D293F] bg-[#0B1220] p-7 shadow-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15295A] text-[#C3D2FF]"><RefreshCw className="h-5 w-5" /></div>
          <h1 className="mt-5 text-xl font-bold">Choose which copy to keep</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8B96AE]">This device and the cloud both contain gym records that differ. Choose carefully. Export a JSON backup before replacing either copy.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={useCloudCopy} className="rounded-lg border border-[#263755] bg-[#111A2E] p-4 text-left hover:border-[#3D6BFF]"><strong className="block text-sm text-[#C3D2FF]">Use cloud copy</strong><span className="mt-1 block text-xs text-[#8B96AE]">Download the cloud data onto this device.</span></button>
            <button type="button" onClick={() => void useThisDeviceCopy()} disabled={loading} className="rounded-lg border border-[#263755] bg-[#111A2E] p-4 text-left hover:border-[#3D6BFF] disabled:opacity-50"><strong className="block text-sm text-[#C3D2FF]">Upload this device</strong><span className="mt-1 block text-xs text-[#8B96AE]">Replace the current cloud copy with this device’s data.</span></button>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#FF9A84]">{error}</p>}
          <p className="mt-5 text-xs text-[#8B96AE]">Signed in as {session.user.email}</p>
        </section>
      </main>
    );
  }
  if (!ready) {
    return <LoginScreen onLogin={login} error={error || 'Cloud initialization did not finish.'} loading={loading} />;
  }
  return <>{children}<SyncBadge status={status} email={session.user.email || undefined} onSignOut={() => void signOut()} /></>;
};
