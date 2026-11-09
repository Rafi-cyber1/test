import type {
  AttendanceRecord,
  AuditLog,
  DoorAccessLog,
  ExpenseRecord,
  GymSettings,
  Member,
  MemberFeeLedgerEntry,
  MembershipHistory,
  MembershipPlan,
  PaymentRecord,
  Product,
  Sale,
  StockPurchase,
  Supplier,
  UserAccount,
  WhatsAppNotification,
  InventoryTransaction,
} from '../../types';
import type { DatabaseState } from '../storage';

/**
 * Mapping between the app's `DatabaseState` and the Supabase tables created by
 * `supabase/migrations/001_schema.sql`.
 *
 * Two rules, and they are the whole contract:
 *   1. `data` holds the complete original object (nothing can ever be lost,
 *      even if the app later adds fields the schema does not know about).
 *   2. The columns beside `data` are a *projection* of it — only the fields
 *      that SQL needs for filtering, sorting, joining or summing.
 *
 * Both directions are pure functions: no network, no storage, easy to test.
 */

export const GYM_ID = 'gym_main';

export type CloudRow = Record<string, unknown>;

export interface CloudTables {
  plans: CloudRow[];
  members: CloudRow[];
  membership_history: CloudRow[];
  member_fee_ledger: CloudRow[];
  payments: CloudRow[];
  attendance: CloudRow[];
  expenses: CloudRow[];
  door_logs: CloudRow[];
  notifications: CloudRow[];
  audit_logs: CloudRow[];
  users: CloudRow[];
  products: CloudRow[];
  sales: CloudRow[];
  stock_purchases: CloudRow[];
  inventory_transactions: CloudRow[];
  suppliers: CloudRow[];
  settings: CloudRow[];
}

export const CLOUD_TABLE_ORDER: (keyof CloudTables)[] = [
  'plans',
  'members',
  'membership_history',
  'member_fee_ledger',
  'payments',
  'attendance',
  'expenses',
  'door_logs',
  'notifications',
  'audit_logs',
  'users',
  'products',
  'sales',
  'stock_purchases',
  'inventory_transactions',
  'suppliers',
  'settings',
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Date-only columns: keep `YYYY-MM-DD` untouched. */
const asDate = (value?: string | null): string | null => {
  if (!value) return null;
  return value.slice(0, 10);
};

/** timestamptz columns: normalise to ISO, return null when unusable. */
const asTimestamp = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ---------------------------------------------------------------------------
// state -> table rows
// ---------------------------------------------------------------------------

export const stateToTables = (state: DatabaseState, gymId: string = GYM_ID): CloudTables => ({
  plans: (state.plans || []).map((plan: MembershipPlan) => ({
    id: plan.id,
    gym_id: gymId,
    name: plan.name,
    price: num(plan.price),
    duration_days: plan.durationDays ?? null,
    is_active: plan.isActive !== false,
    data: clone(plan),
  })),

  members: (state.members || []).map((member: Member) => ({
    id: member.id,
    gym_id: gymId,
    roll_number: member.rollNumber,
    full_name: member.fullName,
    mobile_number: member.mobileNumber || null,
    cnic: member.cnic || null,
    blood_group: member.bloodGroup || null,
    plan_id: member.planId || null,
    plan_name: member.planName || null,
    status: member.status || null,
    payment_status: member.paymentStatus || null,
    total_fee: num(member.totalFee),
    paid_amount: num(member.paidAmount),
    balance_due: num(member.balanceDue),
    join_date: asDate(member.startDate || member.registrationDate),
    expiry_date: asDate(member.expiryDate),
    removed_at: asTimestamp(member.removedAt),
    archived: Boolean(member.archived),
    data: clone(member),
  })),

  membership_history: (state.membershipHistory || []).map((history: MembershipHistory) => ({
    id: history.id,
    gym_id: gymId,
    member_id: history.memberId,
    action_type: history.actionType || null,
    created_at: asTimestamp(history.createdAt),
    data: clone(history),
  })),

  member_fee_ledger: (state.memberFeeLedger || []).map((entry: MemberFeeLedgerEntry) => ({
    id: entry.id,
    gym_id: gymId,
    member_id: entry.memberId,
    entry_date: asDate(entry.date),
    billing_month: entry.billingMonth || null,
    type: entry.type || null,
    amount: num(entry.amount),
    receipt_no: (entry as { receiptNumber?: string }).receiptNumber || null,
    data: clone(entry),
    created_at: asTimestamp(entry.createdAt),
  })),

  payments: (state.payments || []).map((payment: PaymentRecord) => ({
    id: payment.id,
    gym_id: gymId,
    member_id: payment.memberId,
    receipt_number: payment.receiptNumber || null,
    amount: num(payment.amount),
    payment_type: payment.paymentType || null,
    paid_at: asTimestamp(payment.paymentDate || payment.createdAt),
    data: clone(payment),
    created_at: asTimestamp(payment.createdAt),
  })),

  attendance: (state.attendance || []).map((record: AttendanceRecord) => ({
    id: record.id,
    gym_id: gymId,
    member_id: record.memberId,
    method: record.method || null,
    access_status: record.accessStatus || null,
    check_in_at: asTimestamp(record.timestamp || record.checkInTime),
    data: clone(record),
  })),

  expenses: (state.expenses || []).map((expense: ExpenseRecord) => ({
    id: expense.id,
    gym_id: gymId,
    title: expense.title,
    category: expense.category || null,
    amount: num(expense.amount),
    spent_at: asTimestamp(expense.date),
    data: clone(expense),
  })),

  door_logs: (state.doorLogs || []).map((log: DoorAccessLog) => ({
    id: log.id,
    gym_id: gymId,
    member_id: log.memberId || null,
    status: log.status || null,
    occurred_at: asTimestamp(log.timestamp),
    data: clone(log),
  })),

  notifications: (state.notifications || []).map((notification: WhatsAppNotification) => ({
    id: notification.id,
    gym_id: gymId,
    member_id: notification.memberId || null,
    message_type: notification.messageType || null,
    status: notification.status || null,
    created_at: asTimestamp(notification.createdAt),
    data: clone(notification),
  })),

  audit_logs: (state.auditLogs || []).map((log: AuditLog) => ({
    id: log.id,
    gym_id: gymId,
    occurred_at: asTimestamp(log.timestamp),
    module: log.module || null,
    action: log.action || null,
    username: log.username || null,
    data: clone(log),
  })),

  users: (state.users || []).map((user: UserAccount) => ({
    id: user.id,
    gym_id: gymId,
    username: user.username || null,
    full_name: user.fullName || null,
    role: user.role || null,
    email: user.email || null,
    is_active: user.isActive !== false,
    data: clone(user),
  })),

  products: (state.products || []).map((product: Product) => ({
    id: product.id,
    gym_id: gymId,
    code: product.code || null,
    name: product.name,
    category: product.category || null,
    purchase_price: num(product.purchasePrice),
    selling_price: num(product.sellingPrice),
    stock_quantity: num(product.stockQuantity),
    min_stock_level: num(product.minStockLevel),
    is_active: product.isActive !== false,
    data: clone(product),
  })),

  sales: (state.sales || []).map((sale: Sale) => ({
    id: sale.id,
    gym_id: gymId,
    invoice_number: sale.invoiceNumber || null,
    member_id: sale.memberId || null,
    total_amount: num(sale.totalAmount),
    total_cogs: num(sale.totalCogs),
    sold_at: asTimestamp(sale.createdAt || sale.date),
    data: clone(sale),
    created_at: asTimestamp(sale.createdAt),
  })),

  stock_purchases: (state.stockPurchases || []).map((purchase: StockPurchase) => ({
    id: purchase.id,
    gym_id: gymId,
    purchase_number: purchase.purchaseNumber || null,
    total_cost: num(purchase.totalCost),
    purchase_date: asDate(purchase.purchaseDate),
    data: clone(purchase),
  })),

  inventory_transactions: (state.inventoryTransactions || []).map((tx: InventoryTransaction) => ({
    id: tx.id,
    gym_id: gymId,
    product_id: tx.productId || null,
    type: tx.type || null,
    quantity_change: num(tx.quantityChange),
    occurred_at: asTimestamp(tx.timestamp),
    data: clone(tx),
  })),

  suppliers: (state.suppliers || []).map((supplier: Supplier) => ({
    id: supplier.id,
    gym_id: gymId,
    name: supplier.name || null,
    phone: supplier.phone || null,
    data: clone(supplier),
  })),

  settings: [
    {
      gym_id: gymId,
      data: clone(state.settings as GymSettings),
    },
  ],
});

// ---------------------------------------------------------------------------
// table rows -> state
// ---------------------------------------------------------------------------

const pickData = <T,>(rows: CloudRow[] | undefined): T[] =>
  (rows || [])
    .filter((row) => row && (row as { data?: unknown }).data != null)
    .map((row) => clone(row.data) as T);

export const tablesToState = (
  tables: Partial<CloudTables>,
  current: DatabaseState
): DatabaseState => {
  const settingsRows = tables.settings || [];
  const nextSettings =
    settingsRows.length > 0 && settingsRows[0]?.data
      ? (clone(settingsRows[0].data) as GymSettings)
      : current.settings;

  return {
    ...current,
    plans: tables.plans ? pickData<MembershipPlan>(tables.plans) : current.plans,
    members: tables.members ? pickData<Member>(tables.members) : current.members,
    membershipHistory: tables.membership_history
      ? pickData<MembershipHistory>(tables.membership_history)
      : current.membershipHistory,
    memberFeeLedger: tables.member_fee_ledger
      ? pickData<MemberFeeLedgerEntry>(tables.member_fee_ledger)
      : current.memberFeeLedger,
    payments: tables.payments ? pickData<PaymentRecord>(tables.payments) : current.payments,
    attendance: tables.attendance ? pickData<AttendanceRecord>(tables.attendance) : current.attendance,
    expenses: tables.expenses ? pickData<ExpenseRecord>(tables.expenses) : current.expenses,
    doorLogs: tables.door_logs ? pickData<DoorAccessLog>(tables.door_logs) : current.doorLogs,
    notifications: tables.notifications
      ? pickData<WhatsAppNotification>(tables.notifications)
      : current.notifications,
    auditLogs: tables.audit_logs ? pickData<AuditLog>(tables.audit_logs) : current.auditLogs,
    users: tables.users ? pickData<UserAccount>(tables.users) : current.users,
    products: tables.products ? pickData<Product>(tables.products) : current.products,
    sales: tables.sales ? pickData<Sale>(tables.sales) : current.sales,
    stockPurchases: tables.stock_purchases
      ? pickData<StockPurchase>(tables.stock_purchases)
      : current.stockPurchases,
    inventoryTransactions: tables.inventory_transactions
      ? pickData<InventoryTransaction>(tables.inventory_transactions)
      : current.inventoryTransactions,
    suppliers: tables.suppliers ? pickData<Supplier>(tables.suppliers) : current.suppliers,
    settings: nextSettings,
    currentUser: {
      ...current.currentUser,
      fullName: nextSettings?.receptionistProfile?.name || current.currentUser.fullName,
    },
  };
};

/** Row counts used by the settings screen and the import script. */
export const countTables = (tables: Partial<CloudTables>): Record<string, number> =>
  CLOUD_TABLE_ORDER.reduce<Record<string, number>>((acc, table) => {
    acc[table] = (tables[table] || []).length;
    return acc;
  }, {});
