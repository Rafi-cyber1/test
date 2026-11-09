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

const { db } = await import('../../src/db/storage');
const { stateToTables, tablesToState, countTables, GYM_ID } = await import(
  '../../src/db/cloud/mapper'
);

const baseState = () => db.getState();

const member = {
  id: 'mem_test_1',
  rollNumber: 'the-gym-town-99',
  fullName: 'Mapper Test Member',
  mobileNumber: '03001234567',
  whatsappNumber: '03001234567',
  gender: 'Male' as const,
  registrationDate: '2026-10-01',
  planId: 'plan_cardio',
  planName: 'Cardio Only Monthly',
  startDate: '2026-10-01',
  expiryDate: '2026-10-31',
  emergencyContactName: 'Brother',
  emergencyContactPhone: '03007654321',
  status: 'ACTIVE' as const,
  paymentStatus: 'PARTIAL' as const,
  totalFee: 2000,
  paidAmount: 500,
  balanceDue: 1500,
  archived: false,
  updatedAt: '2026-10-01T10:00:00.000Z',
};

test('member row keeps queryable columns and the full original object', () => {
  const state = { ...baseState(), members: [member as any] };
  const tables = stateToTables(state);

  assert.equal(tables.members.length, 1);
  const row = tables.members[0];

  assert.equal(row.id, 'mem_test_1');
  assert.equal(row.gym_id, GYM_ID);
  assert.equal(row.roll_number, 'the-gym-town-99');
  assert.equal(row.balance_due, 1500);
  assert.equal(row.expiry_date, '2026-10-31');
  assert.equal(row.status, 'ACTIVE');
  assert.deepEqual(row.data, member);
});

test('settings are stored as a single gym-scoped jsonb row', () => {
  const state = baseState();
  const tables = stateToTables(state);

  assert.equal(tables.settings.length, 1);
  assert.equal(tables.settings[0].gym_id, GYM_ID);
  assert.deepEqual(tables.settings[0].data, state.settings);
});

test('state -> tables -> state is lossless for every module', () => {
  const state = {
    ...baseState(),
    members: [member as any],
    payments: [
      {
        id: 'pay_1',
        receiptNumber: 'TGT-RCPT-0001',
        memberId: 'mem_test_1',
        rollNumber: 'the-gym-town-99',
        memberName: 'Mapper Test Member',
        amount: 500,
        paymentMethod: 'Cash' as const,
        paymentType: 'MEMBERSHIP' as const,
        paymentDate: '2026-10-01',
        billingMonth: '2026-10',
        receivedBy: 'Bilal Tariq',
        createdAt: '2026-10-01T10:00:00.000Z',
      } as any,
    ],
    memberFeeLedger: [
      {
        id: 'led_1',
        memberId: 'mem_test_1',
        date: '2026-10-01',
        description: 'Monthly fee',
        type: 'CHARGE' as const,
        amount: 2000,
        paymentMethod: null,
        createdAt: '2026-10-01T10:00:00.000Z',
        recordedBy: 'Bilal Tariq',
        billingMonth: '2026-10',
      } as any,
    ],
    products: [
      {
        id: 'prd_1',
        code: 'PRD-001',
        name: 'Water Bottle',
        category: 'Bottled Water' as const,
        purchasePrice: 40,
        sellingPrice: 80,
        stockQuantity: 7,
        minStockLevel: 5,
        isActive: true,
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      } as any,
    ],
    suppliers: [
      { id: 'sup_1', name: 'Hyderabad Drinks', phone: '03001234567', city: 'Hyderabad' } as any,
    ],
    members: [member as any],
  };

  const tables = stateToTables(state);
  const restored = tablesToState(tables, baseState());

  assert.deepEqual(restored.members, state.members);
  assert.deepEqual(restored.payments, state.payments);
  assert.deepEqual(restored.memberFeeLedger, state.memberFeeLedger);
  assert.deepEqual(restored.products, state.products);
  assert.deepEqual(restored.suppliers, state.suppliers);
  assert.deepEqual(restored.settings, state.settings);
});

test('row counts cover every cloud table', () => {
  const tables = stateToTables({ ...baseState(), members: [member as any] });
  const counts = countTables(tables);

  assert.equal(counts.members, 1);
  assert.equal(counts.settings, 1);
  assert.equal(Object.keys(counts).length, 17);
  assert.ok(Object.values(counts).every((count) => typeof count === 'number'));
});

test('partial pulls keep the local tables that were not fetched', () => {
  const state = { ...baseState(), members: [member as any] };
  const restored = tablesToState({ plans: [] }, state);

  // members were not part of the pull, so the local copy survives untouched
  assert.deepEqual(restored.members, state.members);
  // plans *were* fetched and are empty
  assert.deepEqual(restored.plans, []);
});

test('rows without a data payload are ignored instead of crashing', () => {
  const state = baseState();
  const restored = tablesToState(
    { members: [{ id: 'broken', gym_id: GYM_ID } as any] },
    state
  );
  assert.deepEqual(restored.members, []);
});
