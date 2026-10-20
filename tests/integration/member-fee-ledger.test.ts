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

const { addCalendarMonths, db } = await import('../../src/db/storage');
const { ExportService } = await import('../../src/services/exportService');

test('phone validation requires 11 local digits or a Pakistan country-coded number', () => {
  assert.equal(db.isValidPhoneNumber('03001234567'), true);
  assert.equal(db.isValidPhoneNumber('+92 300 1234567'), true);
  assert.equal(db.isValidPhoneNumber('12345678'), false);
  assert.equal(db.isValidPhoneNumber('123456789'), false);
  assert.equal(db.isValidPhoneNumber('0300123456'), false);
  assert.equal(db.isValidPhoneNumber('030012345678'), false);
});

test('member fee ledger lifecycle: enrollment, payment, idempotency, next cycle, and validation', async (t) => {
  const today = new Date().toISOString().slice(0, 10);
  const expiry = new Date(`${today}T00:00:00Z`);
  expiry.setUTCDate(expiry.getUTCDate() + 30);
  const expiryDate = expiry.toISOString().slice(0, 10);

  const member = db.addMember({
    fullName: 'Ledger Integration Member',
    mobileNumber: '03001234567',
    whatsappNumber: '03001234567',
    gender: 'Other',
    bloodGroup: 'O+',
    registrationDate: today,
    planId: 'plan_monthly',
    planName: 'QA Monthly Plan',
    startDate: today,
    expiryDate,
    emergencyContactName: 'QA Contact',
    emergencyContactPhone: '03007654321',
    totalFee: 3000,
    paidAmount: 0,
    monthlyFee: 3000,
    admissionFee: 0,
  }, 'QA-LEDGER-001');

  await t.test('A — enrollment creates the initial unpaid balance', () => {
    assert.equal(member.balanceDue, 3000);
    assert.equal(member.paymentStatus, 'UNPAID');
    assert.equal(member.status, 'PENDING_PAYMENT');
    const charges = db.getMemberFeeLedger(member.id).filter((entry) => entry.type === 'CHARGE');
    assert.equal(charges.length, 1);
    assert.equal(charges[0].amount, 3000);
  });

  test('calendar-month plans clamp dates and preserve monthly billing periods', () => {
    assert.equal(addCalendarMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addCalendarMonths('2024-01-31', 1), '2024-02-29');
    assert.equal(addCalendarMonths('2026-11-30', 2), '2027-01-30');

    const member = db.addMember({
      fullName: 'Custom Billing Member',
      mobileNumber: '03001234568',
      whatsappNumber: '03001234568',
      gender: 'Other',
      bloodGroup: 'O+',
      registrationDate: '2026-01-31',
      planId: 'custom_two_months',
      planName: 'Two Month Custom Plan',
      startDate: '2026-01-31',
      expiryDate: '2026-03-31',
      emergencyContactName: 'QA Contact',
      emergencyContactPhone: '03007654322',
      totalFee: 5000,
      paidAmount: 0,
      monthlyFee: 2000,
      admissionFee: 1000,
      billingMonths: 2,
    }, 'QA-LEDGER-CUSTOM');

    const charges = db.getMemberFeeLedger(member.id).filter((entry) => entry.type === 'CHARGE');
    assert.equal(member.balanceDue, 5000);
    assert.deepEqual(charges.map((entry) => [entry.amount, entry.billingMonth]), [
      [1000, '2026-01'],
      [2000, '2026-01'],
      [2000, '2026-02'],
    ]);

    assert.equal(db.renewMembership(member.id, 'plan_admission_advance', 0), true);
    assert.equal(member.planId, 'plan_monthly');
    assert.equal(db.getMemberFeeLedger(member.id).filter((entry) => entry.type === 'CHARGE').at(-1)?.amount, 2000);
  });

  test('fee ledger CSV escapes text and exports running balances by billing month', () => {
    const csv = ExportService.buildMemberFeeLedgerCsv({
      id: 'csv-member',
      rollNumber: 'CSV-001',
      fullName: 'Member, "Example"',
      mobileNumber: '03001234567',
      whatsappNumber: '03001234567',
      gender: 'Other',
      registrationDate: '2026-01-01',
      planId: 'plan_monthly',
      planName: 'Monthly',
      startDate: '2026-01-01',
      expiryDate: '2026-02-01',
      emergencyContactName: 'Contact',
      emergencyContactPhone: '03007654321',
      status: 'ACTIVE',
      paymentStatus: 'PARTIAL',
      totalFee: 3000,
      paidAmount: 2000,
      balanceDue: 1000,
      archived: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, [
      {
        id: 'payment',
        memberId: 'csv-member',
        date: '2026-01-02',
        description: 'Cash, partial payment',
        type: 'PAYMENT',
        amount: 2000,
        paymentMethod: 'Cash',
        createdAt: '2026-01-02T10:00:00.000Z',
        recordedBy: 'Reception',
        billingMonth: '2026-01',
      },
      {
        id: 'charge',
        memberId: 'csv-member',
        date: '2026-01-01',
        description: 'Membership charge',
        type: 'CHARGE',
        amount: 3000,
        paymentMethod: null,
        createdAt: '2026-01-01T10:00:00.000Z',
        recordedBy: 'System',
        billingMonth: '2026-01',
      },
    ]);

    assert.match(csv, /"Member, ""Example"""/);
    assert.match(csv, /Membership charge.*3000,0,3000/);
    assert.match(csv, /Cash, partial payment.*0,2000,1000/);
  });

  const exactPayment = {
    memberId: member.id,
    rollNumber: member.rollNumber,
    memberName: member.fullName,
    amount: 3000,
    paymentMethod: 'Cash' as const,
    paymentType: 'MEMBERSHIP' as const,
    notes: 'Exact enrollment balance',
  };

  await t.test('B — a single exact payment settles the balance once', () => {
    db.recordPayment(exactPayment, today, 'qa-ledger-exact-payment');
    assert.equal(member.balanceDue, 0);
    assert.equal(member.paymentStatus, 'PAID');
    assert.equal(db.getMemberFeeLedger(member.id).filter((entry) => entry.type === 'PAYMENT').length, 1);
  });

  await t.test('C — replaying the same keyed request creates no duplicate transaction', () => {
    const original = db.getPayments().find((payment) => payment.memberId === member.id);
    const paymentCount = db.getPayments().length;
    const ledgerCount = db.getMemberFeeLedger(member.id).length;
    const replay = db.recordPayment(exactPayment, today, 'qa-ledger-exact-payment');

    assert.equal(replay.id, original?.id);
    assert.equal(db.getPayments().length, paymentCount);
    assert.equal(db.getMemberFeeLedger(member.id).length, ledgerCount);
    assert.equal(member.balanceDue, 0);
  });

  await t.test('D — the next cycle adds one charge and supports staged payments', () => {
    assert.equal(db.renewMembership(member.id, 'plan_monthly', 0), true);
    assert.equal(member.totalFee, 5000);
    assert.equal(member.balanceDue, 2000);

    db.recordPayment({
      ...exactPayment,
      amount: 1000,
      notes: 'Second cycle partial payment',
    }, today, 'qa-ledger-second-cycle-partial');
    assert.equal(member.balanceDue, 1000);
    assert.equal(member.paymentStatus, 'PARTIAL');

    db.recordPayment({
      ...exactPayment,
      amount: 1000,
      notes: 'Second cycle final payment',
    }, today, 'qa-ledger-second-cycle-final');
    assert.equal(member.totalFee, 5000);
    assert.equal(member.balanceDue, 0);
    assert.equal(db.getMemberFeeLedger(member.id).filter((entry) => entry.type === 'CHARGE').length, 2);
  });

  await t.test('E — advance payment becomes credit rather than disappearing', () => {
    db.recordPayment({
      ...exactPayment,
      amount: 500,
      notes: 'Advance credit',
    }, today, 'qa-ledger-advance-credit');
    assert.equal(member.balanceDue, -500);
    assert.equal(member.paymentStatus, 'PAID');
  });

  await t.test('F — reusing an idempotency key for a changed request is rejected', () => {
    const paymentCount = db.getPayments().length;
    const ledgerCount = db.getMemberFeeLedger(member.id).length;
    assert.throws(
      () => db.recordPayment({
        ...exactPayment,
        amount: 2999,
      }, today, 'qa-ledger-exact-payment'),
      /Payment request key has already been used for a different payment/
    );
    assert.equal(db.getPayments().length, paymentCount);
    assert.equal(db.getMemberFeeLedger(member.id).length, ledgerCount);
    assert.equal(member.balanceDue, -500);
  });

  await t.test('G — invalid amounts and calendar dates are rejected without mutation', () => {
    const paymentCount = db.getPayments().length;
    const ledgerCount = db.getMemberFeeLedger(member.id).length;
    const invalidAmounts: unknown[] = [0, -1, '3000'];

    for (const amount of invalidAmounts) {
      assert.throws(
        () => Reflect.apply(db.recordPayment, db, [{
          ...exactPayment,
          amount,
        }]),
        /Payment amount must be a finite value greater than zero/
      );
    }

    for (const invalidDate of ['not-a-date', '2026-02-30']) {
      assert.throws(
        () => db.recordPayment(exactPayment, invalidDate),
        /Payment date must be a valid calendar date/
      );
    }

    assert.equal(db.getPayments().length, paymentCount);
    assert.equal(db.getMemberFeeLedger(member.id).length, ledgerCount);
    assert.equal(member.balanceDue, -500);
  });

  await t.test('H — ledger and derived balance are persisted', () => {
    const persisted = JSON.parse(storedValues.get('tgt_db_data') || '{}');
    const persistedMember = persisted.members.find((candidate: { id: string }) => candidate.id === member.id);
    const persistedLedger = persisted.memberFeeLedger.filter(
      (entry: { memberId: string }) => entry.memberId === member.id
    );
    assert.equal(persistedMember.balanceDue, -500);
    assert.equal(persistedLedger.length, 6);
    assert.equal(persistedLedger.filter((entry: { type: string }) => entry.type === 'CHARGE').length, 2);
    assert.equal(persistedLedger.filter((entry: { type: string }) => entry.type === 'PAYMENT').length, 4);
  });
});
