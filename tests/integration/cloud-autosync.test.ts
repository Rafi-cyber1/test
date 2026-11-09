import assert from 'node:assert/strict';
import { test } from 'node:test';

const storedValues = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, String(value)),
    removeItem: (key: string) => storedValues.delete(key),
    clear: () => storedValues.clear(),
    key: (index: number) => [...storedValues.keys()][index] ?? null,
    get length() {
      return storedValues.size;
    },
  },
});

// --- a tiny in-memory stand-in for /api/sync -------------------------------
type CloudRecord = { version: number; updatedAt: string; updatedBy: string; snapshot: any } | null;
let cloud: CloudRecord = null;
let postFailures = 0;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

globalThis.fetch = (async (_url: string, init?: RequestInit) => {
  const method = (init?.method || 'GET').toUpperCase();

  if (method === 'GET') {
    return jsonResponse(200, {
      ok: true,
      empty: cloud === null,
      version: cloud?.version || 0,
      updatedAt: cloud?.updatedAt || null,
      updatedBy: cloud?.updatedBy || null,
      snapshot: cloud?.snapshot || null,
    });
  }

  const body = JSON.parse(String(init?.body || '{}'));
  const currentVersion = cloud?.version || 0;

  if (postFailures > 0) {
    postFailures -= 1;
    return jsonResponse(500, { ok: false, error: 'network hiccup' });
  }

  if (cloud && Number(body.baseVersion || 0) !== currentVersion) {
    return jsonResponse(409, { ok: false, conflict: true, error: 'newer data exists' });
  }

  cloud = {
    version: currentVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: body.updatedBy || 'test',
    snapshot: body.snapshot,
  };
  return jsonResponse(200, { ok: true, version: cloud.version, updatedAt: cloud.updatedAt });
}) as typeof fetch;

const { db } = await import('../../src/db/storage');
const { setSyncKey } = await import('../../src/services/cloudSync');
const { cloudAutoSync } = await import('../../src/services/cloudAutoSync');

const seedMember = (name: string, roll: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const expiry = new Date(`${today}T00:00:00Z`);
  expiry.setUTCDate(expiry.getUTCDate() + 30);
  return db.addMember({
    fullName: name,
    mobileNumber: '03001234567',
    whatsappNumber: '03001234567',
    gender: 'Male',
    bloodGroup: 'O+',
    registrationDate: today,
    planId: 'plan_admission_advance',
    planName: 'Cardio Only Admission',
    startDate: today,
    expiryDate: expiry.toISOString().slice(0, 10),
    totalFee: 4000,
    paidAmount: 4000,
    admissionFee: 4000,
    monthlyFee: 0,
    billingMonths: 1,
    emergencyContactName: 'Brother',
    emergencyContactPhone: '03007654321',
    notes: '',
  } as any);
};

const resetEngine = () => {
  cloudAutoSync.stop();
  localStorage.setItem('tgt_cloud_version', '0');
  setSyncKey('test-sync-key');
  cloud = null;
  postFailures = 0;
};

test('first run on an empty cloud uploads this desk and marks it synced', async () => {
  resetEngine();
  db.clearAllData();
  seedMember('Autosync Alpha', 'the-gym-town-autosync-1');

  await cloudAutoSync.bootstrap();

  const state = cloudAutoSync.getState();
  assert.equal(state.status, 'synced');
  assert.equal(state.version, 1);
  assert.equal(cloud?.version, 1);
  assert.equal(cloud?.snapshot?.database?.members?.length, 1);
  assert.equal(cloud?.snapshot?.database?.members?.[0]?.fullName, 'Autosync Alpha');
});

test('a brand-new device (empty browser) pulls the cloud copy automatically', async () => {
  resetEngine();
  db.clearAllData();
  seedMember('Autosync Cloud Member', 'the-gym-town-autosync-2');
  await cloudAutoSync.bootstrap(); // seeds the cloud
  assert.equal(cloud?.version, 1);

  // simulate a fresh browser: no local members, no remembered version
  localStorage.setItem('tgt_cloud_version', '0');
  db.clearAllData();

  await cloudAutoSync.bootstrap();

  const state = cloudAutoSync.getState();
  assert.equal(state.status, 'synced');
  assert.equal(db.getMembers().length, 1);
  assert.equal(db.getMembers()[0].fullName, 'Autosync Cloud Member');
  assert.equal(localStorage.getItem('tgt_cloud_version'), '1');
});

test('both sides holding data is never guessed — the engine asks for a choice', async () => {
  resetEngine();
  db.clearAllData();
  seedMember('Cloud Owner', 'the-gym-town-autosync-3');
  await cloudAutoSync.bootstrap();

  // second device with its own data and no remembered version
  localStorage.setItem('tgt_cloud_version', '0');
  db.clearAllData();
  seedMember('Local Owner', 'the-gym-town-autosync-4');

  await cloudAutoSync.bootstrap();

  const state = cloudAutoSync.getState();
  assert.equal(state.status, 'needs-choice');
  assert.equal(db.getMembers().length, 1);
  assert.equal(db.getMembers()[0].fullName, 'Local Owner');
});

test('a later push that loses the race reports a conflict instead of overwriting', async () => {
  resetEngine();
  db.clearAllData();
  seedMember('Race Member', 'the-gym-town-autosync-5');
  await cloudAutoSync.bootstrap(); // version 1

  // another desk saved version 2 in the meantime
  cloud = { ...(cloud as any), version: 2, updatedAt: new Date().toISOString() };

  await cloudAutoSync.push();

  assert.equal(cloudAutoSync.getState().status, 'conflict');
  assert.equal(cloud?.version, 2); // untouched
});

test('a failed upload keeps the data local and reports an error state', async () => {
  resetEngine();
  db.clearAllData();
  seedMember('Retry Member', 'the-gym-town-autosync-6');
  await cloudAutoSync.bootstrap();
  assert.equal(cloud?.version, 1);

  postFailures = 1;
  await cloudAutoSync.push();

  const state = cloudAutoSync.getState();
  assert.ok(['error', 'offline'].includes(state.status));
  assert.equal(cloud?.version, 1, 'cloud copy must not change on failure');
  assert.equal(db.getMembers().length, 1, 'local data must survive a failed push');
});

test('manual download restores the cloud copy even after a conflict', async () => {
  resetEngine();
  db.clearAllData();
  seedMember('Conflict Source', 'the-gym-town-autosync-7');
  await cloudAutoSync.bootstrap();

  // another desk pushes a different member, then we lose the race
  db.clearAllData();
  seedMember('Other Desk Member', 'the-gym-town-autosync-8');
  await cloudAutoSync.forceUpload();
  const latest = cloudAutoSync.getState().version;

  localStorage.setItem('tgt_cloud_version', '1');
  await cloudAutoSync.push(); // stale base → conflict
  assert.equal(cloudAutoSync.getState().status, 'conflict');

  await cloudAutoSync.forceDownload();

  assert.equal(cloudAutoSync.getState().status, 'synced');
  assert.equal(cloudAutoSync.getState().version, latest);
  assert.equal(db.getMembers()[0].fullName, 'Other Desk Member');
});
