import {
  Member,
  MembershipPlan,
  MembershipHistory,
  MembershipPeriod,
  AttendanceRecord,
  PaymentRecord,
  ExpenseRecord,
  DoorAccessLog,
  WhatsAppNotification,
  UserAccount,
  AuditLog,
  GymSettings,
  MembershipStatus,
  ReceptionistProfile,
  PaymentMethod,
  MemberFeeLedgerEntry,
  Product,
  ProductCategory,
  Sale,
  SaleItem,
  StockPurchase,
  StockPurchaseItem,
  InventoryTransaction,
  Supplier,
  StockMovementType,
  BloodGroup,
} from '../types';
import { appStorage } from './appStorage';

const STORAGE_PREFIX = 'tgt_db_';
const CLEAN_V2_FLAG = 'tgt_db_clean_v2';
const BLOOD_GROUPS = new Set<BloodGroup>(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const INVALID_PHONE_NUMBER_ERROR =
  'Enter a valid phone number with exactly 11 digits, or 12 digits including Pakistan country code 92.';
const DEMO_MEMBER_EMAIL_PATTERN = /^demo\.member\.\d{3}@example\.test$/;

const normalizePhoneNumber = (phone: string): string => {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return digits;
};

export const addCalendarMonths = (date: string, months: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return formatDate(new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))));
};

const monthFromDate = (date: string): string => date.slice(0, 7);
const isValidCalendarDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

export interface DatabaseState {
  members: Member[];
  plans: MembershipPlan[];
  membershipHistory: MembershipHistory[];
  memberFeeLedger: MemberFeeLedgerEntry[];
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  doorLogs: DoorAccessLog[];
  notifications: WhatsAppNotification[];
  users: UserAccount[];
  auditLogs: AuditLog[];
  settings: GymSettings;
  currentUser: UserAccount;
  lastBackupDate?: string;
  // Inventory & Daily Sales Management
  products: Product[];
  sales: Sale[];
  stockPurchases: StockPurchase[];
  inventoryTransactions: InventoryTransaction[];
  suppliers: Supplier[];
}

// Admission includes the first month; subsequent periods are billed monthly.
const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'plan_admission_advance',
    name: 'Cardio Only Admission',
    durationDays: 30,
    durationMonths: 1,
    price: 4000,
    description: 'Rs. 2,000 one-time admission fee + Rs. 2,000 first month.',
    isActive: true,
    trainingType: 'CARDIO',
    features: ['Cardio equipment access'],
  },
  {
    id: 'plan_monthly',
    name: 'Cardio Only Monthly',
    durationDays: 30,
    durationMonths: 1,
    price: 2000,
    description: 'Cardio equipment access, billed per calendar month.',
    isActive: true,
    trainingType: 'CARDIO',
    features: ['Cardio equipment access'],
  },
  {
    id: 'plan_admission_muscle',
    name: 'Muscle Building Admission',
    durationDays: 30,
    durationMonths: 1,
    price: 4000,
    description: 'Rs. 2,000 one-time admission fee + Rs. 2,000 first month.',
    isActive: true,
    trainingType: 'MUSCLE_BUILDING',
    features: ['Muscle building floor access'],
  },
  {
    id: 'plan_monthly_muscle',
    name: 'Muscle Building Monthly',
    durationDays: 30,
    durationMonths: 1,
    price: 2000,
    description: 'Muscle building floor access, billed per calendar month.',
    isActive: true,
    trainingType: 'MUSCLE_BUILDING',
    features: ['Muscle building floor access'],
  },
];

// Default Gym Inventory Products Catalog
const DEFAULT_PRODUCTS: Product[] = [
  // Bottled Water
  {
    id: 'prd_water_500',
    code: 'WAT-01',
    name: 'Aquafina Mineral Water 500ml',
    category: 'Bottled Water',
    purchasePrice: 40,
    sellingPrice: 70,
    stockQuantity: 48,
    minStockLevel: 15,
    supplierName: 'Sindh Beverage & Water Traders',
    unit: 'Bottle',
    description: 'Chilled mineral drinking water bottle.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prd_water_1500',
    code: 'WAT-02',
    name: 'Nestle Pure Life 1.5L Big Bottle',
    category: 'Bottled Water',
    purchasePrice: 75,
    sellingPrice: 120,
    stockQuantity: 24,
    minStockLevel: 8,
    supplierName: 'Sindh Beverage & Water Traders',
    unit: 'Bottle',
    description: '1.5 Liter large hydration bottle.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Energy Drinks
  {
    id: 'prd_sting_300',
    code: 'ENG-01',
    name: 'Sting Energy Berry Blast 300ml',
    category: 'Energy Drinks',
    purchasePrice: 90,
    sellingPrice: 130,
    stockQuantity: 36,
    minStockLevel: 12,
    supplierName: 'Sindh Beverage & Water Traders',
    unit: 'Bottle',
    description: 'Pre-workout instant caffeinated energy boost.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prd_redbull_250',
    code: 'ENG-02',
    name: 'Red Bull Energy Drink Can 250ml',
    category: 'Energy Drinks',
    purchasePrice: 380,
    sellingPrice: 480,
    stockQuantity: 18,
    minStockLevel: 6,
    supplierName: 'Sindh Beverage & Water Traders',
    unit: 'Can',
    description: 'Premium Austrian taurine energy drink.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Protein Shakes
  {
    id: 'prd_shake_whey_choc',
    code: 'SHK-01',
    name: 'Whey Protein Shake (Double Choc)',
    category: 'Protein Shakes',
    purchasePrice: 220,
    sellingPrice: 400,
    stockQuantity: 30,
    minStockLevel: 10,
    supplierName: 'Pakistan Sports Nutrition',
    unit: 'Scoop/Glass',
    description: '25g cold milk whey isolate post-workout shake.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prd_shake_gainer_banana',
    code: 'SHK-02',
    name: 'Mass Gainer Shake (Banana Cream)',
    category: 'Protein Shakes',
    purchasePrice: 240,
    sellingPrice: 420,
    stockQuantity: 20,
    minStockLevel: 8,
    supplierName: 'Pakistan Sports Nutrition',
    unit: 'Scoop/Glass',
    description: 'High calorie mass builder shake with oats and banana.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Protein Bars
  {
    id: 'prd_bar_muscletech',
    code: 'BAR-01',
    name: 'MuscleTech NitroTech Protein Bar 60g',
    category: 'Protein Bars',
    purchasePrice: 320,
    sellingPrice: 450,
    stockQuantity: 16,
    minStockLevel: 6,
    supplierName: 'Pakistan Sports Nutrition',
    unit: 'Bar',
    description: '22g protein crunch bar with low sugar.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Snacks
  {
    id: 'prd_snack_nuts',
    code: 'SNK-01',
    name: 'Roasted Almond & Peanut Energy Pack',
    category: 'Snacks',
    purchasePrice: 110,
    sellingPrice: 180,
    stockQuantity: 25,
    minStockLevel: 8,
    supplierName: 'Sindh Beverage & Water Traders',
    unit: 'Pack',
    description: 'Natural roasted salted gym endurance nuts.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Supplements
  {
    id: 'prd_supp_creatine',
    code: 'SUP-01',
    name: 'Creatine Monohydrate Pure 5g Shot',
    category: 'Supplements',
    purchasePrice: 80,
    sellingPrice: 160,
    stockQuantity: 50,
    minStockLevel: 15,
    supplierName: 'Pakistan Sports Nutrition',
    unit: 'Scoop',
    description: 'Micronized German creatine for explosive strength.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prd_supp_preworkout',
    code: 'SUP-02',
    name: 'C4 High Energy Pre-Workout Shot',
    category: 'Supplements',
    purchasePrice: 140,
    sellingPrice: 260,
    stockQuantity: 40,
    minStockLevel: 10,
    supplierName: 'Pakistan Sports Nutrition',
    unit: 'Scoop',
    description: 'Beta-alanine and caffeine pump formula.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Gym Accessories
  {
    id: 'prd_acc_shaker',
    code: 'ACC-01',
    name: 'The Gym Town Heavy Shaker 700ml',
    category: 'Gym Accessories',
    purchasePrice: 450,
    sellingPrice: 850,
    stockQuantity: 12,
    minStockLevel: 4,
    supplierName: 'IronGrip Gym Accessories Wholesale',
    unit: 'Piece',
    description: 'BPA-free wire blender shaker with gym town insignia.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prd_acc_straps',
    code: 'ACC-02',
    name: 'Heavy Duty Weightlifting Wrist Straps',
    category: 'Gym Accessories',
    purchasePrice: 650,
    sellingPrice: 1100,
    stockQuantity: 10,
    minStockLevel: 3,
    supplierName: 'IronGrip Gym Accessories Wholesale',
    unit: 'Pair',
    description: 'Cotton padded deadlift and rowing wrist straps.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Other
  {
    id: 'prd_oth_towel',
    code: 'OTH-01',
    name: 'Gym Town Microfiber Workout Towel',
    category: 'Other',
    purchasePrice: 350,
    sellingPrice: 600,
    stockQuantity: 15,
    minStockLevel: 5,
    supplierName: 'IronGrip Gym Accessories Wholesale',
    unit: 'Piece',
    description: 'Quick dry sweat towel with clip.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Default Suppliers Directory
const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_01',
    name: 'Sindh Beverage & Water Traders',
    contactPerson: 'Tariq Mehmood',
    phone: '+92 300 3981245',
    city: 'Hyderabad',
    address: 'Station Road, Saddar, Hyderabad',
    categoriesSupplied: ['Bottled Water', 'Energy Drinks', 'Snacks'],
  },
  {
    id: 'sup_02',
    name: 'Pakistan Sports Nutrition',
    contactPerson: 'Asad Farooq',
    phone: '+92 321 8291044',
    city: 'Karachi / Hyderabad',
    address: 'Auto Bhan Commercial Hub, Hyderabad',
    categoriesSupplied: ['Protein Shakes', 'Supplements', 'Protein Bars'],
  },
  {
    id: 'sup_03',
    name: 'IronGrip Gym Accessories Wholesale',
    contactPerson: 'Rashid Ali',
    phone: '+92 333 4910283',
    city: 'Hyderabad Hub',
    address: 'Latifabad Unit 7, Hyderabad',
    categoriesSupplied: ['Gym Accessories', 'Other'],
  },
];

// Male Reception Desk Officer Account (Editable in Settings)
const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr_reception',
    username: 'bilal_reception',
    fullName: 'Bilal Tariq',
    role: 'RECEPTIONIST',
    email: 'bilal.reception@thegymtown.pk',
    isActive: true,
  },
];

// Default Settings - Located in Hyderabad, Sindh, Pakistan with Editable Male Receptionist
const DEFAULT_SETTINGS: GymSettings = {
  gymName: 'The Gym Town',
  tagline: 'Strength & Conditioning Club | IronCore Arena',
  address: 'Auto Bhan Road, Near Citizen Colony, Saddar',
  city: 'Hyderabad, Sindh, Pakistan',
  phone: '+92 22 2781 440',
  whatsapp: '+92 301 8392011',
  email: 'reception.hyd@thegymtown.pk',
  currency: 'Rs.',
  timezone: 'Asia/Karachi',
  whatsappProvider: 'CLICK_TO_CHAT',
  autoBackupEnabled: true,
  backupFrequencyHours: 24,
  receptionistProfile: {
    name: 'Bilal Tariq',
    phone: '+92 301 9283741',
    shift: 'Morning Shift (06:00 AM - 02:00 PM)',
    counterId: 'Desk 01 - Main Gate',
    notes: 'Front Desk Officer on Duty',
  },
};

const formatDate = (d: Date) => d.toISOString().split('T')[0];

const datePlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

/**
 * Enterprise Database and Storage Engine
 * Stores structured data with reactive subscriptions and transaction safety.
 * Zero dummy members seeded as requested — user inputs their own real members.
 */
class DatabaseManager {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
    this.recomputeStatuses();
  }

  private createLegacyMemberFeeLedger(
    members: Member[],
    history: MembershipHistory[],
    payments: PaymentRecord[]
  ): MemberFeeLedgerEntry[] {
    const entries: MemberFeeLedgerEntry[] = history
      .filter((record) => record.finalPrice > 0)
      .map((record) => ({
        id: `ledger_charge_${record.id}`,
        memberId: record.memberId,
        date: record.startDate,
        description: `${record.actionType === 'NEW' ? 'Enrollment' : record.actionType === 'REJOIN' ? 'Rejoin' : 'Membership renewal'} charge (${record.planName})`,
        type: 'CHARGE',
        amount: record.finalPrice,
        paymentMethod: null,
        createdAt: record.createdAt,
        recordedBy: 'System Migration',
      }));

    payments
      .filter((payment) => payment.paymentType === 'MEMBERSHIP' || payment.paymentType === 'REGISTRATION')
      .forEach((payment) => {
        entries.push({
          id: `ledger_payment_${payment.id}`,
          memberId: payment.memberId,
          date: payment.createdAt.slice(0, 10),
          description: payment.notes || `${payment.paymentType === 'REGISTRATION' ? 'Registration' : 'Membership'} payment`,
          type: 'PAYMENT',
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          createdAt: payment.createdAt,
          recordedBy: payment.receivedBy,
          paymentId: payment.id,
        });
      });

    members.forEach((member) => {
      const memberCharges = entries.filter((entry) => entry.memberId === member.id && entry.type === 'CHARGE');
      if (memberCharges.length === 0 && member.totalFee > 0) {
        entries.push({
          id: `ledger_charge_migration_${member.id}`,
          memberId: member.id,
          date: member.registrationDate || member.startDate,
          description: `Membership charges (${member.planName})`,
          type: 'CHARGE',
          amount: member.totalFee,
          paymentMethod: null,
          createdAt: member.updatedAt,
          recordedBy: 'System Migration',
        });
      }

      const memberPayments = entries.filter((entry) => entry.memberId === member.id && entry.type === 'PAYMENT');
      const recordedPaid = memberPayments.reduce((sum, entry) => sum + entry.amount, 0);
      if (member.paidAmount > recordedPaid) {
        entries.push({
          id: `ledger_payment_migration_${member.id}`,
          memberId: member.id,
          date: member.registrationDate || member.startDate,
          description: 'Recorded payments (legacy balance migration)',
          type: 'PAYMENT',
          amount: member.paidAmount - recordedPaid,
          paymentMethod: null,
          createdAt: member.updatedAt,
          recordedBy: 'System Migration',
        });
      }
    });

    return entries;
  }

  private recomputeLedgerBalances(state: DatabaseState = this.state): void {
    state.members.forEach((member) => {
      const entries = state.memberFeeLedger.filter((entry) => entry.memberId === member.id);
      const charges = entries
        .filter((entry) => entry.type === 'CHARGE')
        .reduce((sum, entry) => sum + entry.amount, 0);
      const payments = entries
        .filter((entry) => entry.type === 'PAYMENT')
        .reduce((sum, entry) => sum + entry.amount, 0);
      member.totalFee = charges;
      member.paidAmount = payments;
      member.balanceDue = charges - payments;
      member.paymentStatus = member.balanceDue > 0
        ? member.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'
        : 'PAID';
    });
  }

  private addMemberFeeCharge(
    member: Member,
    amount: number,
    date: string,
    description: string,
    billingMonth?: string
  ): void {
    if (amount <= 0) return;
    this.state.memberFeeLedger.push({
      id: `ledger_charge_${member.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      memberId: member.id,
      date,
      description,
      type: 'CHARGE',
      amount,
      paymentMethod: null,
      billingMonth,
      createdAt: new Date().toISOString(),
      recordedBy: this.state.settings.receptionistProfile?.name || this.state.currentUser.fullName,
    });
    this.recomputeLedgerBalances();
  }

  private loadState(): DatabaseState {
    try {
      const stored = appStorage.getItem(`${STORAGE_PREFIX}data`);

      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Stored application data has an invalid structure.');
        }
        
        // Ensure settings has receptionistProfile
        const settings = {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
          receptionistProfile: parsed.settings?.receptionistProfile || DEFAULT_SETTINGS.receptionistProfile,
        };

        const receptionistName = settings.receptionistProfile?.name || 'Bilal Tariq';
        const currentUser: UserAccount = {
          id: 'usr_reception',
          username: 'reception',
          fullName: receptionistName,
          role: 'RECEPTIONIST',
          email: 'reception@thegymtown.pk',
          isActive: true,
        };

        const standardPlanIds = new Set([
          'plan_admission_advance',
          'plan_monthly',
          'plan_quarterly',
          'plan_halfyearly',
          'plan_annual',
          'plan_admission_muscle',
          'plan_monthly_muscle',
        ]);
        const customPlans = Array.isArray(parsed.plans)
          ? parsed.plans.filter((plan: MembershipPlan) => !standardPlanIds.has(plan.id))
          : [];
        const plansToUse = [...DEFAULT_PLANS, ...customPlans];

        const productsToUse = Array.isArray(parsed.products) && parsed.products.length > 0
          ? parsed.products
          : DEFAULT_PRODUCTS;

        const suppliersToUse = Array.isArray(parsed.suppliers) && parsed.suppliers.length > 0
          ? parsed.suppliers
          : DEFAULT_SUPPLIERS;

        const membersToUse: Member[] = Array.isArray(parsed.members)
          ? parsed.members.map((member: Member) => ({
              ...member,
              membershipPeriods: Array.isArray(member.membershipPeriods) && member.membershipPeriods.length > 0
                ? member.membershipPeriods
                : [{
                    id: `mperiod_${member.id}_1`,
                    startDate: member.registrationDate || member.startDate,
                  }],
            }))
          : [];
        const storedAttendance: AttendanceRecord[] = Array.isArray(parsed.attendance) ? parsed.attendance : [];
        const attendanceToUse = storedAttendance.map((record) => {
          const member = membersToUse.find((candidate) => candidate.id === record.memberId);
          return member && record.rollNumber !== member.rollNumber
            ? { ...record, rollNumber: member.rollNumber }
            : record;
        });
        if (attendanceToUse.some((record, index) => record !== storedAttendance[index])
          || JSON.stringify(parsed.plans) !== JSON.stringify(plansToUse)) {
          appStorage.setItem(`${STORAGE_PREFIX}data`, JSON.stringify({
            ...parsed,
            attendance: attendanceToUse,
            plans: plansToUse,
          }));
        }

        const migratedState: DatabaseState = {
          members: membersToUse,
          plans: plansToUse,
          membershipHistory: Array.isArray(parsed.membershipHistory) ? parsed.membershipHistory : [],
          memberFeeLedger: Array.isArray(parsed.memberFeeLedger)
            ? parsed.memberFeeLedger
            : this.createLegacyMemberFeeLedger(
                membersToUse,
                Array.isArray(parsed.membershipHistory) ? parsed.membershipHistory : [],
                Array.isArray(parsed.payments) ? parsed.payments : []
              ),
          attendance: attendanceToUse,
          payments: Array.isArray(parsed.payments) ? parsed.payments : [],
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
          doorLogs: Array.isArray(parsed.doorLogs) ? parsed.doorLogs : [],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
          users: [currentUser],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          settings,
          currentUser,
          lastBackupDate: parsed.lastBackupDate,
          // Inventory & POS
          products: productsToUse,
          sales: Array.isArray(parsed.sales) ? parsed.sales : [],
          stockPurchases: Array.isArray(parsed.stockPurchases) ? parsed.stockPurchases : [],
          inventoryTransactions: Array.isArray(parsed.inventoryTransactions) ? parsed.inventoryTransactions : [],
          suppliers: suppliersToUse,
        };
        this.recomputeLedgerBalances(migratedState);
        if (!Array.isArray(parsed.memberFeeLedger)) {
          appStorage.setItem(`${STORAGE_PREFIX}data`, JSON.stringify(migratedState));
        }
        appStorage.setItem(CLEAN_V2_FLAG, 'true');
        return migratedState;
      }
      appStorage.setItem(CLEAN_V2_FLAG, 'true');
    } catch (error) {
      throw new Error('Saved application data could not be loaded. The stored data was left unchanged.', { cause: error });
    }

    const initialCurrentUser = DEFAULT_USERS[0];
    const cleanState: DatabaseState = {
      members: [], // Zero dummy data as requested!
      plans: DEFAULT_PLANS,
      membershipHistory: [],
      memberFeeLedger: [],
      attendance: [],
      payments: [],
      expenses: [],
      doorLogs: [],
      notifications: [],
      users: DEFAULT_USERS,
      auditLogs: [
        {
          id: `aud_${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: initialCurrentUser.id,
          username: initialCurrentUser.username,
          action: 'STATION_READY',
          module: 'System',
          details: 'The Gym Town Hyderabad Reception Desk initialized with zero dummy records.',
        },
      ],
      settings: DEFAULT_SETTINGS,
      currentUser: initialCurrentUser,
      lastBackupDate: new Date().toISOString(),
      products: DEFAULT_PRODUCTS,
      sales: [],
      stockPurchases: [],
      inventoryTransactions: [],
      suppliers: DEFAULT_SUPPLIERS,
    };

    try {
      appStorage.setItem(`${STORAGE_PREFIX}data`, JSON.stringify(cleanState));
      appStorage.setItem(CLEAN_V2_FLAG, 'true');
    } catch (error) {
      throw new Error('Unable to initialize application storage.', { cause: error });
    }

    return cleanState;
  }

  private persist(): void {
    try {
      appStorage.setItem(`${STORAGE_PREFIX}data`, JSON.stringify(this.state));
    } catch (error) {
      console.error('Storage persistence failed', error);
      throw new Error('Unable to save application data. Check available browser storage and try again.', { cause: error });
    }
    this.notify();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Recalculates member statuses based on dates and payments
   */
  public recomputeStatuses(): void {
    const nowStr = formatDate(new Date());
    const threeDaysAhead = datePlus(3);

    let changed = false;
    this.state.members = this.state.members.map((m) => {
      let newStatus: MembershipStatus = m.status;

      if (m.status === 'FROZEN') {
        return m;
      }

      if (m.balanceDue > 0 && m.paidAmount === 0) {
        newStatus = 'PENDING_PAYMENT';
      } else if (m.expiryDate < nowStr) {
        newStatus = 'EXPIRED';
      } else if (m.expiryDate <= threeDaysAhead) {
        newStatus = 'EXPIRING_SOON';
      } else {
        newStatus = 'ACTIVE';
      }

      if (newStatus !== m.status) {
        changed = true;
        return { ...m, status: newStatus };
      }
      return m;
    });

    if (changed) {
      this.persist();
    }
  }

  // --- GETTERS ---
  public getState(): DatabaseState {
    return this.state;
  }

  public getMembers(): Member[] {
    return this.state.members.filter((m) => !m.archived);
  }

  public getAllMembers(): Member[] {
    return this.state.members;
  }

  public async seedDemoData(): Promise<number> {
    if (this.state.members.some((member) => DEMO_MEMBER_EMAIL_PATTERN.test(member.email || ''))) {
      throw new Error('Demo records already exist. Remove them before adding the demo dataset again.');
    }

    const today = new Date();
    const todayString = formatDate(today);
    const plans = this.state.plans.filter((plan) => plan.isActive);
    const bloodGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const paymentMethods: PaymentMethod[] = ['Cash'];

    for (let index = 1; index <= 120; index += 1) {
      const memberNumber = index.toString().padStart(3, '0');
      const plan = plans[index % plans.length] || DEFAULT_PLANS[1];
      const paymentMethod: PaymentMethod = 'Cash';
      const expiryOffset = index % 10 === 0 ? -7 : index % 10 === 1 ? 2 : 30;
      const expiry = new Date(`${todayString}T00:00:00Z`);
      expiry.setUTCDate(expiry.getUTCDate() + expiryOffset);
      const registration = new Date(`${todayString}T00:00:00Z`);
      registration.setUTCDate(registration.getUTCDate() - (index % 90));
      const registrationDate = formatDate(registration);
      const phone = `0300${(1000 + index).toString().padStart(7, '0')}`;
      const fee = plan.price;
      const paidAmount = index % 4 === 0 ? 0 : index % 4 === 1 ? Math.floor(fee / 2) : fee;

      const member = this.addMember({
        fullName: `DEMO - Member ${memberNumber}`,
        fatherName: `Demo Parent ${memberNumber}`,
        mobileNumber: phone,
        whatsappNumber: phone,
        email: `demo.member.${memberNumber}@example.test`,
        gender: index % 2 === 0 ? 'Male' : 'Female',
        bloodGroup: bloodGroups[index % bloodGroups.length],
        registrationDate,
        planId: plan.id,
        planName: plan.name,
        startDate: registrationDate,
        expiryDate: formatDate(expiry),
        emergencyContactName: `Demo Contact ${memberNumber}`,
        emergencyContactPhone: `0300${(9000 + index).toString().padStart(7, '0')}`,
        notes: 'DEMO DATA ONLY — do not contact this number.',
        totalFee: fee,
        paidAmount,
        admissionFee: plan.id.startsWith('plan_admission') ? 2000 : 0,
        monthlyFee: plan.id.startsWith('plan_admission') ? fee - 2000 : fee,
        billingMonths: 1,
      }, `DEMO-TGT-${memberNumber}-X`);

      const initialPayment = this.state.payments.find((payment) => payment.memberId === member.id);
      if (initialPayment) {
        initialPayment.paymentMethod = paymentMethod;
        const ledgerPayment = this.state.memberFeeLedger.find((entry) => entry.paymentId === initialPayment.id);
        if (ledgerPayment) ledgerPayment.paymentMethod = paymentMethod;
      }

      if (member.paidAmount > 0 && member.status !== 'EXPIRED' && index % 3 !== 0) {
        this.recordAttendance({
          memberId: member.id,
          rollNumber: member.rollNumber,
          memberName: member.fullName,
          method: 'MANUAL',
          accessStatus: 'GRANTED',
          notes: 'Demo attendance record for testing.',
        });
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 1));
    }

    this.addAuditLog('SYSTEM', 'Demo Dataset Added', 'Added 120 clearly labeled demo member profiles for testing.');
    this.persist();
    return 120;
  }

  public removeDemoData(): number {
    const demoMembers = this.state.members.filter((member) =>
      DEMO_MEMBER_EMAIL_PATTERN.test(member.email || '')
    );
    if (demoMembers.length === 0) return 0;

    const demoMemberIds = new Set(demoMembers.map((member) => member.id));
    this.state.members = this.state.members.filter((member) => !demoMemberIds.has(member.id));
    this.state.membershipHistory = this.state.membershipHistory.filter((entry) => !demoMemberIds.has(entry.memberId));
    this.state.memberFeeLedger = this.state.memberFeeLedger.filter((entry) => !demoMemberIds.has(entry.memberId));
    this.state.attendance = this.state.attendance.filter((entry) => !demoMemberIds.has(entry.memberId));
    this.state.payments = this.state.payments.filter((entry) => !demoMemberIds.has(entry.memberId));
    this.state.doorLogs = this.state.doorLogs.filter((entry) => !demoMemberIds.has(entry.memberId));
    this.state.notifications = this.state.notifications.filter((entry) => !demoMemberIds.has(entry.memberId));
    this.state.sales = this.state.sales.filter((entry) => !entry.memberId || !demoMemberIds.has(entry.memberId));
    this.state.auditLogs = this.state.auditLogs.filter((entry) =>
      !entry.details.includes('DEMO - Member ')
    );
    this.addAuditLog('SYSTEM', 'Demo Dataset Removed', `Removed ${demoMembers.length} demo member profiles and their related records.`);
    this.persist();
    return demoMembers.length;
  }

  public getDemoMemberCount(): number {
    return this.state.members.filter((member) =>
      DEMO_MEMBER_EMAIL_PATTERN.test(member.email || '')
    ).length;
  }

  public getMemberById(id: string): Member | undefined {
    return this.state.members.find((m) => m.id === id);
  }

  public getMemberByRollNumber(rollNumber: string): Member | undefined {
    if (!rollNumber) return undefined;
    const clean = rollNumber.trim().toLowerCase();
    const digitsOnly = clean.replace(/[^\d]/g, '');
    const num = digitsOnly ? parseInt(digitsOnly, 10) : NaN;

    return this.state.members.find((m) => {
      const mRoll = m.rollNumber.toLowerCase().trim();
      if (mRoll === clean) return true;
      if (clean.startsWith('the-gym-town-') && mRoll === clean) return true;
      if (mRoll === `the-gym-town-${clean}`) return true;
      if (digitsOnly && mRoll === `the-gym-town-${digitsOnly.padStart(2, '0')}`) return true;
      if (!isNaN(num)) {
        const mDigits = mRoll.replace(/[^\d]/g, '');
        if (mDigits && parseInt(mDigits, 10) === num) return true;
      }
      return mRoll.endsWith(clean);
    });
  }

  public getMemberByPhone(phone: string): Member | undefined {
    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone) return undefined;

    return this.state.members.find(
      (member) => normalizePhoneNumber(member.mobileNumber) === cleanPhone && !member.archived
    ) || this.state.members.find(
      (member) => normalizePhoneNumber(member.mobileNumber) === cleanPhone
    );
  }

  public isValidPhoneNumber(phone: string): boolean {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');
    return /^\+?[\d\s().-]+$/.test(trimmed)
      && (digits.length === 11 || (digits.length === 12 && digits.startsWith('92')));
  }

  public getPlans(): MembershipPlan[] {
    return this.state.plans;
  }

  public getPayments(): PaymentRecord[] {
    return this.state.payments;
  }

  public getMemberFeeLedger(memberId: string): MemberFeeLedgerEntry[] {
    return this.state.memberFeeLedger
      .filter((entry) => entry.memberId === memberId)
      .sort((a, b) => {
        const dateOrder = a.date.localeCompare(b.date);
        if (dateOrder !== 0) return dateOrder;
        return new Date(a.createdAt.replace(' ', 'T')).getTime()
          - new Date(b.createdAt.replace(' ', 'T')).getTime();
      });
  }

  public getExpenses(): ExpenseRecord[] {
    return this.state.expenses;
  }

  public getAttendance(): AttendanceRecord[] {
    return this.state.attendance;
  }

  public isAttendanceMarkedToday(memberId: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return this.state.attendance.some(
      (record) =>
        record.memberId === memberId
        && record.accessStatus === 'GRANTED'
        && record.timestamp.slice(0, 10) === today
    );
  }

  public getDoorLogs(): DoorAccessLog[] {
    return this.state.doorLogs;
  }

  public getNotifications(): WhatsAppNotification[] {
    return this.state.notifications;
  }

  public getSettings(): GymSettings {
    return this.state.settings;
  }

  public getCurrentUser(): UserAccount {
    return this.state.currentUser;
  }

  public setCurrentUser(user: UserAccount): void {
    this.state.currentUser = user;
    this.persist();
  }

  public updateReceptionistProfile(profile: ReceptionistProfile): void {
    if (profile.phone.trim() && !this.isValidPhoneNumber(profile.phone)) {
      throw new Error(INVALID_PHONE_NUMBER_ERROR);
    }
    this.state.settings.receptionistProfile = profile;
    this.state.currentUser.fullName = profile.name;
    this.addAuditLog('STAFF', 'Receptionist Updated', `Front Desk Officer set to ${profile.name} (${profile.shift})`);
    this.persist();
  }

  // --- MEMBER OPERATIONS ---

  /**
   * Generates next sequential concise Roll Number / Unique ID, e.g. the-gym-town-01
   */
  public generateNextRollNumber(): string {
    const prefix = 'the-gym-town-';
    const existing = this.state.members
      .map((m) => {
        const match = m.rollNumber.match(/the-gym-town-(\d+)/i) || m.rollNumber.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const highest = existing.length > 0 ? Math.max(...existing) : 0;
    const next = highest + 1;
    return `${prefix}${next.toString().padStart(2, '0')}`;
  }

  public isRollNumberTaken(rollNumber: string): boolean {
    const cleanRollNumber = rollNumber.trim().toLowerCase();
    return this.state.members.some((member) => member.rollNumber.trim().toLowerCase() === cleanRollNumber);
  }

  public isDuplicateMember(phone: string, email?: string, excludeId?: string): { duplicate: boolean; reason?: string } {
    const cleanPhone = normalizePhoneNumber(phone);
    const foundPhone = this.state.members.find(
      (m) => !m.archived && m.id !== excludeId && normalizePhoneNumber(m.mobileNumber) === cleanPhone
    );
    if (foundPhone) {
      return { duplicate: true, reason: `Phone number already registered to ${foundPhone.fullName} (${foundPhone.rollNumber})` };
    }

    if (email && email.trim().length > 0) {
      const cleanEmail = email.trim().toLowerCase();
      const foundEmail = this.state.members.find(
        (m) => !m.archived && m.id !== excludeId && m.email?.trim().toLowerCase() === cleanEmail
      );
      if (foundEmail) {
        return { duplicate: true, reason: `Email address already registered to ${foundEmail.fullName} (${foundEmail.rollNumber})` };
      }
    }

    return { duplicate: false };
  }

  public addMember(
    memberData: Omit<Member, 'id' | 'rollNumber' | 'updatedAt' | 'archived' | 'status' | 'paymentStatus' | 'balanceDue'>,
    customRollNumber?: string
  ): Member {
    if (!this.isValidPhoneNumber(memberData.mobileNumber)) {
      throw new Error(INVALID_PHONE_NUMBER_ERROR);
    }
    for (const phone of [memberData.whatsappNumber, memberData.emergencyContactPhone]) {
      if (phone?.trim() && !this.isValidPhoneNumber(phone)) {
        throw new Error(INVALID_PHONE_NUMBER_ERROR);
      }
    }
    if (!memberData.bloodGroup || !BLOOD_GROUPS.has(memberData.bloodGroup)) {
      throw new Error('A valid blood group is required.');
    }
    if (!Number.isFinite(memberData.totalFee) || !Number.isFinite(memberData.paidAmount)
      || memberData.totalFee < 0 || memberData.paidAmount < 0 || memberData.paidAmount > memberData.totalFee) {
      throw new Error('Registration fees must be non-negative, and payment cannot exceed the total fee.');
    }
    const rollNumber = customRollNumber || this.generateNextRollNumber();
    if (!rollNumber.trim()) {
      throw new Error('A member roll number is required.');
    }
    if (this.isRollNumberTaken(rollNumber)) {
      throw new Error(`Roll number ${rollNumber} is already assigned to a member.`);
    }
    const id = `mem_${Date.now()}`;
    const balanceDue = Math.max(0, memberData.totalFee - memberData.paidAmount);

    let paymentStatus: Member['paymentStatus'] = 'PAID';
    if (memberData.paidAmount === 0) {
      paymentStatus = 'UNPAID';
    } else if (balanceDue > 0) {
      paymentStatus = 'PARTIAL';
    }

    const todayStr = formatDate(new Date());
    let status: MembershipStatus = 'ACTIVE';
    if (paymentStatus === 'UNPAID') {
      status = 'PENDING_PAYMENT';
    } else if (memberData.expiryDate < todayStr) {
      status = 'EXPIRED';
    } else if (memberData.expiryDate <= datePlus(3)) {
      status = 'EXPIRING_SOON';
    }

    const newMember: Member = {
      ...memberData,
      id,
      rollNumber,
      status,
      paymentStatus,
      balanceDue,
      archived: false,
      membershipPeriods: memberData.membershipPeriods?.length
        ? memberData.membershipPeriods
        : [{ id: `mperiod_${id}_1`, startDate: memberData.startDate }],
      updatedAt: new Date().toISOString(),
    };

    this.state.members.unshift(newMember);
    const admissionFee = memberData.admissionFee ?? 0;
    const monthlyFee = memberData.monthlyFee ?? 0;
    const billingMonths = Math.max(1, memberData.billingMonths ?? 1);
    if (admissionFee > 0 || monthlyFee > 0) {
      this.addMemberFeeCharge(
        newMember,
        admissionFee,
        memberData.registrationDate,
        'One-time admission fee',
        monthFromDate(memberData.registrationDate)
      );
      for (let month = 0; month < billingMonths && monthlyFee > 0; month += 1) {
        const billingDate = addCalendarMonths(memberData.registrationDate, month);
        this.addMemberFeeCharge(
          newMember,
          monthlyFee,
          billingDate,
          `Membership fee — ${monthFromDate(billingDate)}`,
          monthFromDate(billingDate)
        );
      }
    } else {
      this.addMemberFeeCharge(
        newMember,
        memberData.totalFee,
        memberData.registrationDate,
        `Enrollment charge (${newMember.planName})`,
        monthFromDate(memberData.registrationDate)
      );
    }

    // If initial payment was made, automatically record transaction
    if (memberData.paidAmount > 0) {
      this.recordPayment({
        memberId: newMember.id,
        rollNumber: newMember.rollNumber,
        memberName: newMember.fullName,
        amount: memberData.paidAmount,
        paymentMethod: 'Cash',
        paymentType: 'REGISTRATION',
        billingMonth: monthFromDate(memberData.registrationDate),
        notes: `Initial walk-in registration fee (${newMember.planName})`,
      });
    }

    // Add to membership history
    this.state.membershipHistory.unshift({
      id: `mhist_${Date.now()}`,
      memberId: newMember.id,
      rollNumber: newMember.rollNumber,
      planId: newMember.planId,
      planName: newMember.planName,
      startDate: newMember.startDate,
      expiryDate: newMember.expiryDate,
      price: newMember.totalFee,
      discount: 0,
      finalPrice: newMember.totalFee,
      paidAmount: newMember.paidAmount,
      actionType: 'NEW',
      createdAt: new Date().toISOString(),
      notes: 'Initial walk-in membership registration',
    });

    this.addAuditLog('MEMBERS', 'New Member Registered', `Enrolled ${newMember.fullName} (${newMember.rollNumber})`);
    this.persist();
    return newMember;
  }

  public rejoinMember(
    id: string,
    memberData: Omit<Member, 'id' | 'rollNumber' | 'updatedAt' | 'archived' | 'status' | 'paymentStatus' | 'balanceDue'>
  ): Member {
    const member = this.getMemberById(id);
    if (!member || !member.archived) {
      throw new Error('The returning member profile could not be found or is not marked as left.');
    }
    if (!this.isValidPhoneNumber(memberData.mobileNumber)) {
      throw new Error(INVALID_PHONE_NUMBER_ERROR);
    }
    for (const phone of [memberData.whatsappNumber, memberData.emergencyContactPhone]) {
      if (phone?.trim() && !this.isValidPhoneNumber(phone)) {
        throw new Error(INVALID_PHONE_NUMBER_ERROR);
      }
    }
    if (!memberData.bloodGroup || !BLOOD_GROUPS.has(memberData.bloodGroup)) {
      throw new Error('A valid blood group is required.');
    }
    if (!Number.isFinite(memberData.totalFee) || !Number.isFinite(memberData.paidAmount)
      || memberData.totalFee < 0 || memberData.paidAmount < 0 || memberData.paidAmount > memberData.totalFee) {
      throw new Error('Rejoining fees must be non-negative, and payment cannot exceed the current fee.');
    }

    const membershipPeriods: MembershipPeriod[] = member.membershipPeriods?.length
      ? [...member.membershipPeriods]
      : [{ id: `mperiod_${member.id}_1`, startDate: member.registrationDate || member.startDate }];
    membershipPeriods.push({
      id: `mperiod_${member.id}_${membershipPeriods.length + 1}`,
      startDate: memberData.startDate,
    });

    const totalFee = member.totalFee + memberData.totalFee;
    const paidAmount = member.paidAmount + memberData.paidAmount;
    const balanceDue = totalFee - paidAmount;
    const todayStr = formatDate(new Date());
    let status: MembershipStatus = 'ACTIVE';
    if (memberData.paidAmount === 0) {
      status = 'PENDING_PAYMENT';
    } else if (memberData.expiryDate < todayStr) {
      status = 'EXPIRED';
    } else if (memberData.expiryDate <= datePlus(3)) {
      status = 'EXPIRING_SOON';
    }

    Object.assign(member, memberData, {
      id: member.id,
      rollNumber: member.rollNumber,
      registrationDate: member.registrationDate,
      membershipPeriods,
      archived: false,
      totalFee,
      paidAmount,
      balanceDue,
      paymentStatus: balanceDue === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
      status,
      updatedAt: new Date().toISOString(),
    });
    this.addMemberFeeCharge(
      member,
      memberData.totalFee,
      memberData.registrationDate,
      `Rejoin charge (${member.planName})`
    );

    this.state.membershipHistory.unshift({
      id: `mhist_${Date.now()}`,
      memberId: member.id,
      rollNumber: member.rollNumber,
      planId: member.planId,
      planName: member.planName,
      startDate: member.startDate,
      expiryDate: member.expiryDate,
      price: memberData.totalFee,
      discount: 0,
      finalPrice: memberData.totalFee,
      paidAmount: memberData.paidAmount,
      actionType: 'REJOIN',
      createdAt: new Date().toISOString(),
      notes: `Rejoined using existing member profile; original join date ${member.registrationDate} retained.`,
    });

    if (memberData.paidAmount > 0) {
      this.recordPayment({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        amount: memberData.paidAmount,
        paymentMethod: 'Cash',
        paymentType: 'REGISTRATION',
        notes: `Rejoining membership fee (${member.planName})`,
      });
    }

    this.addAuditLog('MEMBERS', 'Member Rejoined', `${member.fullName} (${member.rollNumber}) rejoined with their existing profile`);
    this.persist();
    return member;
  }

  public updateMember(id: string, updates: Partial<Member>): Member | null {
    const index = this.state.members.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const duplicate = this.isDuplicateMember(
      updates.mobileNumber || this.state.members[index].mobileNumber,
      updates.email ?? this.state.members[index].email,
      id
    );
    if (duplicate.duplicate) throw new Error(duplicate.reason || 'Member contact details are already in use.');
    if (updates.bloodGroup && !BLOOD_GROUPS.has(updates.bloodGroup)) {
      throw new Error('A valid blood group is required.');
    }
    if (updates.mobileNumber !== undefined && !this.isValidPhoneNumber(updates.mobileNumber)) {
      throw new Error(INVALID_PHONE_NUMBER_ERROR);
    }
    for (const phone of [updates.whatsappNumber, updates.emergencyContactPhone]) {
      if (phone?.trim() && !this.isValidPhoneNumber(phone)) {
        throw new Error(INVALID_PHONE_NUMBER_ERROR);
      }
    }
    if (updates.totalFee !== undefined || updates.paidAmount !== undefined || updates.balanceDue !== undefined) {
      throw new Error('Member fee totals are maintained by the fee ledger.');
    }
    for (const date of [updates.registrationDate, updates.startDate, updates.expiryDate]) {
      if (date !== undefined && !isValidCalendarDate(date)) {
        throw new Error('Member dates must be valid calendar dates.');
      }
    }

    this.recomputeLedgerBalances();
    const current = this.state.members[index];
    const totalFee = current.totalFee;
    const paidAmount = current.paidAmount;
    const balanceDue = totalFee - paidAmount;

    let paymentStatus: Member['paymentStatus'] = 'PAID';
    if (paidAmount === 0) {
      paymentStatus = 'UNPAID';
    } else if (balanceDue > 0) {
      paymentStatus = 'PARTIAL';
    }

    const updated: Member = {
      ...current,
      ...updates,
      status: current.status === 'FROZEN'
        ? 'FROZEN'
        : balanceDue > 0 && paidAmount === 0
          ? 'PENDING_PAYMENT'
          : (updates.expiryDate || current.expiryDate) < formatDate(new Date())
            ? 'EXPIRED'
            : (updates.expiryDate || current.expiryDate) <= datePlus(3)
              ? 'EXPIRING_SOON'
              : 'ACTIVE',
      balanceDue,
      paymentStatus,
      updatedAt: new Date().toISOString(),
    };

    this.state.members[index] = updated;
    this.addAuditLog('MEMBERS', 'Member Updated', `Updated details for ${updated.fullName} (${updated.rollNumber})`);
    this.persist();
    return updated;
  }

  public archiveMember(id: string): boolean {
    return this.leaveMember(id);
  }

  public leaveMember(id: string): boolean {
    const member = this.getMemberById(id);
    if (!member || member.archived) return false;

    const membershipPeriods: MembershipPeriod[] = member.membershipPeriods?.length
      ? [...member.membershipPeriods]
      : [{ id: `mperiod_${member.id}_1`, startDate: member.registrationDate || member.startDate }];
    const currentPeriod = membershipPeriods[membershipPeriods.length - 1];
    if (!currentPeriod.endDate) {
      currentPeriod.endDate = formatDate(new Date());
    }
    member.membershipPeriods = membershipPeriods;
    member.archived = true;
    member.updatedAt = new Date().toISOString();
    this.addAuditLog('MEMBERS', 'Member Left', `Marked ${member.fullName} (${member.rollNumber}) as left; profile history retained`);
    this.persist();
    return true;
  }

  public restoreMember(id: string): boolean {
    const member = this.state.members.find((candidate) => candidate.id === id);
    if (!member || !member.archived) return false;

    member.archived = false;
    const today = formatDate(new Date());
    if (member.expiryDate >= today) {
      const periods = member.membershipPeriods?.length
        ? [...member.membershipPeriods]
        : [{ id: `mperiod_${member.id}_1`, startDate: member.registrationDate || member.startDate }];
      const lastPeriod = periods[periods.length - 1];
      if (lastPeriod.endDate) {
        periods.push({ id: `mperiod_${member.id}_${periods.length + 1}`, startDate: today });
      }
      member.membershipPeriods = periods;
    }
    member.status = member.balanceDue > 0 && member.paidAmount === 0
      ? 'PENDING_PAYMENT'
      : member.expiryDate < today
        ? 'EXPIRED'
        : member.expiryDate <= datePlus(3)
          ? 'EXPIRING_SOON'
          : 'ACTIVE';
    member.updatedAt = new Date().toISOString();
    this.addAuditLog('MEMBERS', 'Member Restored', `Restored ${member.fullName} (${member.rollNumber}) to the active directory`);
    this.persist();
    return true;
  }

  // --- PLAN OPERATIONS ---

  public addPlan(plan: Omit<MembershipPlan, 'id'>): MembershipPlan {
    const newPlan: MembershipPlan = {
      ...plan,
      id: `plan_${Date.now()}`,
    };
    this.state.plans.push(newPlan);
    this.addAuditLog('PLANS', 'Plan Created', `Created membership plan ${newPlan.name} (Rs. ${newPlan.price})`);
    this.persist();
    return newPlan;
  }

  public updatePlan(id: string, updates: Partial<MembershipPlan>): boolean {
    const plan = this.state.plans.find((p) => p.id === id);
    if (!plan) return false;
    Object.assign(plan, updates);
    this.addAuditLog('PLANS', 'Plan Updated', `Updated plan parameters for ${plan.name}`);
    this.persist();
    return true;
  }

  public resetPlansToDefault(): void {
    this.state.plans = JSON.parse(JSON.stringify(DEFAULT_PLANS));
    this.addAuditLog('PLANS', 'Plans Reset', 'Reset membership plans to standard Rs. 4,000 Advance & Rs. 2,000 Monthly structure');
    this.persist();
  }

  public deletePlan(id: string): boolean {
    const idx = this.state.plans.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const removed = this.state.plans.splice(idx, 1)[0];
      this.addAuditLog('PLANS', 'Plan Deleted', `Deleted plan ${removed.name}`);
      this.persist();
      return true;
    }
    return false;
  }

  // --- MEMBERSHIP LIFECYCLE ---

  public renewMembership(
    memberId: string,
    planId: string,
    amountPaid: number,
    paymentMethod: PaymentRecord['paymentMethod'] = 'Cash',
    discount: number = 0
  ): boolean {
    if (paymentMethod !== 'Cash') {
      throw new Error('The Gym Town accepts cash payments only.');
    }
    const member = this.getMemberById(memberId);
    const renewalPlanId = planId === 'plan_admission_advance'
      ? 'plan_monthly'
      : planId === 'plan_admission_muscle'
        ? 'plan_monthly_muscle'
        : planId;
    const plan = this.state.plans.find((p) => p.id === renewalPlanId)
      || (member && member.planId === renewalPlanId
        ? {
            id: member.planId,
            name: member.planName,
            durationDays: 30,
            durationMonths: 1,
            price: member.monthlyFee ?? 2000,
            description: 'Member-specific monthly fee',
            isActive: true,
            trainingType: 'CUSTOM' as const,
          }
        : undefined);
    if (!member || !plan) return false;
    if (member.archived) {
      throw new Error('A left member must be rejoined from the registration form before renewing.');
    }

    const todayStr = formatDate(new Date());
    let baseStartDate = todayStr;
    if (member.status === 'ACTIVE' || member.status === 'EXPIRING_SOON') {
      if (member.expiryDate > todayStr) {
        baseStartDate = member.expiryDate;
      }
    }

    const billingMonths = plan.durationMonths || Math.max(1, Math.round(plan.durationDays / 30));
    const newExpiryStr = addCalendarMonths(baseStartDate, billingMonths);

    if (!Number.isFinite(discount) || discount < 0 || discount > plan.price) {
      throw new Error('Discount must be a valid amount between zero and the plan price.');
    }
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      throw new Error('Payment amount must be a valid non-negative amount.');
    }
    const lateFee = member.expiryDate < todayStr ? 500 : 0;
    const finalFee = plan.price + lateFee - discount;
    if (amountPaid > member.balanceDue + finalFee) {
      throw new Error('Payment amount cannot exceed the outstanding balance after renewal.');
    }

    member.planId = plan.id;
    member.planName = plan.name;
    member.startDate = baseStartDate;
    member.expiryDate = newExpiryStr;
    member.totalFee = member.totalFee + finalFee;
    member.balanceDue = member.balanceDue + finalFee;
    member.status = 'ACTIVE';
    member.paymentStatus = member.balanceDue === 0 ? 'PAID' : member.paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
    member.updatedAt = new Date().toISOString();
    const billingMonth = monthFromDate(baseStartDate);
    this.addMemberFeeCharge(
      member,
      finalFee,
      baseStartDate,
      `Membership renewal charge (${plan.name}) — ${billingMonth}${lateFee ? ' + Rs. 500 overdue late fee' : ''}`,
      billingMonth
    );

    this.state.membershipHistory.unshift({
      id: `mhist_${Date.now()}`,
      memberId: member.id,
      rollNumber: member.rollNumber,
      planId: plan.id,
      planName: plan.name,
      startDate: baseStartDate,
      expiryDate: newExpiryStr,
      price: plan.price,
      discount,
      finalPrice: finalFee,
      paidAmount: amountPaid,
      actionType: 'RENEWAL',
      createdAt: new Date().toISOString(),
      notes: `Renewed at Reception Desk`,
    });

    if (amountPaid > 0) {
      this.recordPayment({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        amount: amountPaid,
        paymentMethod,
        paymentType: 'MEMBERSHIP',
        lateFee: Math.min(lateFee, Math.max(0, amountPaid - (plan.price - discount))),
        billingMonth,
        notes: `Renewal payment for ${plan.name}${lateFee ? ' including Rs. 500 overdue late fee' : ''}`,
      });
    }

    this.addAuditLog('MEMBERS', 'Membership Renewed', `Renewed ${member.fullName} (${member.rollNumber}) until ${newExpiryStr}`);
    this.persist();
    return true;
  }

  public freezeMembership(memberId: string, reason: string): boolean {
    const member = this.getMemberById(memberId);
    if (!member) return false;

    member.status = 'FROZEN';
    member.notes = (member.notes ? member.notes + ' | ' : '') + `[FROZEN ${formatDate(new Date())}]: ${reason}`;
    member.updatedAt = new Date().toISOString();

    this.state.membershipHistory.unshift({
      id: `mhist_${Date.now()}`,
      memberId: member.id,
      rollNumber: member.rollNumber,
      planId: member.planId,
      planName: member.planName,
      startDate: member.startDate,
      expiryDate: member.expiryDate,
      price: 0,
      discount: 0,
      finalPrice: 0,
      paidAmount: 0,
      actionType: 'FREEZE',
      createdAt: new Date().toISOString(),
      notes: reason,
    });

    this.addAuditLog('MEMBERS', 'Membership Frozen', `Froze membership for ${member.fullName} (${member.rollNumber}): ${reason}`);
    this.persist();
    return true;
  }

  public resumeMembership(memberId: string, daysToAdd: number = 0): boolean {
    const member = this.getMemberById(memberId);
    if (!member) return false;

    const expiryDate = new Date(member.expiryDate);
    if (daysToAdd > 0) {
      expiryDate.setDate(expiryDate.getDate() + daysToAdd);
      member.expiryDate = formatDate(expiryDate);
    }

    member.status = 'ACTIVE';
    member.notes = (member.notes ? member.notes + ' | ' : '') + `[RESUMED ${formatDate(new Date())}]`;
    member.updatedAt = new Date().toISOString();

    this.state.membershipHistory.unshift({
      id: `mhist_${Date.now()}`,
      memberId: member.id,
      rollNumber: member.rollNumber,
      planId: member.planId,
      planName: member.planName,
      startDate: member.startDate,
      expiryDate: member.expiryDate,
      price: 0,
      discount: 0,
      finalPrice: 0,
      paidAmount: 0,
      actionType: 'RESUME',
      createdAt: new Date().toISOString(),
      notes: `Resumed membership with ${daysToAdd} extended days`,
    });

    this.addAuditLog('MEMBERS', 'Membership Resumed', `Resumed membership for ${member.fullName} (${member.rollNumber})`);
    this.persist();
    return true;
  }

  // --- ATTENDANCE & DOOR ACCESS LOGIC ---

  public verifyDoorAccess(rollNumberOrId: string, method: AttendanceRecord['method'] = 'QR_SCAN'): {
    granted: boolean;
    reason: string;
    member?: Member;
  } {
    this.recomputeStatuses();
    const member = this.getMemberByRollNumber(rollNumberOrId) || this.getMemberById(rollNumberOrId);

    if (!member) {
      const denialReason = 'Roll Number not found in system';
      this.recordDoorAccessLog({
        memberId: 'unknown',
        rollNumber: rollNumberOrId,
        memberName: 'Unrecognized Member',
        method,
        status: 'DENIED',
        denialReason,
        controllerDevice: 'Front-Desk-Station',
      });
      return { granted: false, reason: denialReason };
    }

    if (member.archived) {
      const denialReason = 'Member profile is archived / deactivated';
      this.recordDoorAccessLog({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        method,
        status: 'DENIED',
        denialReason,
        controllerDevice: 'Front-Desk-Station',
      });
      return { granted: false, reason: denialReason, member };
    }

    if (this.isAttendanceMarkedToday(member.id)) {
      const denialReason = 'Attendance already marked for today.';
      this.recordDoorAccessLog({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        method,
        status: 'DENIED',
        denialReason,
        controllerDevice: 'Front-Desk-Station',
      });
      return { granted: false, reason: denialReason, member };
    }

    if (member.status === 'FROZEN') {
      const denialReason = 'Membership is currently FROZEN';
      this.recordDoorAccessLog({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        method,
        status: 'DENIED',
        denialReason,
        controllerDevice: 'Front-Desk-Station',
      });
      return { granted: false, reason: denialReason, member };
    }

    if (member.status === 'EXPIRED') {
      const denialReason = `Membership EXPIRED on ${member.expiryDate}. Please renew.`;
      this.recordDoorAccessLog({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        method,
        status: 'DENIED',
        denialReason,
        controllerDevice: 'Front-Desk-Station',
      });
      return { granted: false, reason: denialReason, member };
    }

    if (member.status === 'PENDING_PAYMENT' && member.paidAmount === 0) {
      const denialReason = 'Payment pending. No active membership payment found.';
      this.recordDoorAccessLog({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        method,
        status: 'DENIED',
        denialReason,
        controllerDevice: 'Front-Desk-Station',
      });
      return { granted: false, reason: denialReason, member };
    }

    // Access Approved!
    this.recordDoorAccessLog({
      memberId: member.id,
      rollNumber: member.rollNumber,
      memberName: member.fullName,
      method,
      status: 'GRANTED',
      controllerDevice: 'Front-Desk-Station',
    });

    this.recordAttendance({
      memberId: member.id,
      rollNumber: member.rollNumber,
      memberName: member.fullName,
      method,
      accessStatus: 'GRANTED',
    });

    return { granted: true, reason: 'Membership active. Welcome to The Gym Town!', member };
  }

  public recordDoorAccessLog(entry: Omit<DoorAccessLog, 'id' | 'timestamp'>): DoorAccessLog {
    const log: DoorAccessLog = {
      ...entry,
      id: `door_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    this.state.doorLogs.unshift(log);
    if (this.state.doorLogs.length > 500) {
      this.state.doorLogs.pop();
    }
    this.persist();
    return log;
  }

  public recordAttendance(entry: Omit<AttendanceRecord, 'id' | 'timestamp' | 'checkInTime'>): AttendanceRecord {
    const now = new Date();
    let canonicalEntry = entry;
    if (entry.accessStatus === 'GRANTED') {
      const member = this.getMemberById(entry.memberId);
      if (!member || member.archived) {
        throw new Error('Student not found! Please enter a valid Roll Number.');
      }
      if (this.isAttendanceMarkedToday(member.id)) {
        throw new Error('Attendance already marked for today.');
      }
      canonicalEntry = {
        ...entry,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
      };
    }
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const record: AttendanceRecord = {
      ...canonicalEntry,
      id: `att_${Date.now()}`,
      timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
      checkInTime: timeStr,
    };
    this.state.attendance.unshift(record);
    this.persist();
    return record;
  }

  // --- FINANCIAL OPERATIONS ---

  public recordPayment(
    entry: Omit<PaymentRecord, 'id' | 'receiptNumber' | 'createdAt' | 'receivedBy'>,
    ledgerDate: string = formatDate(new Date()),
    idempotencyKey?: string
  ): PaymentRecord {
    if (entry.paymentMethod !== 'Cash') {
      throw new Error('The Gym Town accepts cash payments only.');
    }
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
      throw new Error('Payment amount must be a finite value greater than zero.');
    }
    const parsedLedgerDate = new Date(`${ledgerDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ledgerDate)
      || Number.isNaN(parsedLedgerDate.getTime())
      || parsedLedgerDate.toISOString().slice(0, 10) !== ledgerDate) {
      throw new Error('Payment date must be a valid calendar date.');
    }
    const member = this.getMemberById(entry.memberId);
    if (idempotencyKey) {
      const existingLedgerEntry = this.state.memberFeeLedger.find(
        (ledgerEntry) => ledgerEntry.idempotencyKey === idempotencyKey
      );
      if (existingLedgerEntry) {
        const existingPayment = this.state.payments.find(
          (payment) => payment.id === existingLedgerEntry.paymentId
        );
        if (
          existingPayment
          && existingLedgerEntry.date === ledgerDate
          && existingPayment.memberId === entry.memberId
          && existingPayment.amount === entry.amount
          && existingPayment.paymentMethod === entry.paymentMethod
          && existingPayment.paymentType === entry.paymentType
          && existingPayment.notes === entry.notes
        ) {
          return existingPayment;
        }
        throw new Error('Payment request key has already been used for a different payment.');
      }
    }
    const receiptSeq = (this.state.payments.length + 1).toString().padStart(4, '0');
    const receiptNumber = `REC-${new Date().getFullYear()}-${receiptSeq}`;
    const receivedBy = this.state.settings.receptionistProfile?.name || this.state.currentUser.fullName || 'Bilal Tariq';
    const billingMonth = entry.billingMonth || monthFromDate(ledgerDate);
    const overdueFeeDue = member
      ? this.state.memberFeeLedger
          .filter((ledgerEntry) => ledgerEntry.memberId === member.id
            && ledgerEntry.type === 'CHARGE'
            && ledgerEntry.billingMonth === billingMonth
            && ledgerEntry.description.includes('Rs. 500 overdue late fee'))
          .length * 500
      : 0;
    const overdueFeeAlreadyPaid = member
      ? this.state.payments
          .filter((existing) => existing.memberId === member.id && existing.billingMonth === billingMonth)
          .reduce((total, existing) => total + (existing.lateFee || 0), 0)
      : 0;
    const lateFee = Math.min(
      entry.amount,
      entry.lateFee ?? Math.max(0, overdueFeeDue - overdueFeeAlreadyPaid)
    );

    const payment: PaymentRecord = {
      ...entry,
      lateFee,
      paymentDate: ledgerDate,
      billingMonth,
      bloodGroup: entry.bloodGroup || this.getMemberById(entry.memberId)?.bloodGroup,
      id: `pay_${Date.now()}_${receiptSeq}`,
      receiptNumber,
      receivedBy,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    // Adjust member balance if paying against membership
    const previousMember = member ? { ...member } : undefined;
    this.state.payments.unshift(payment);
    let ledgerEntry: MemberFeeLedgerEntry | undefined;
    if (member && (entry.paymentType === 'MEMBERSHIP' || entry.paymentType === 'REGISTRATION')) {
      ledgerEntry = {
        id: `ledger_payment_${payment.id}`,
        memberId: member.id,
        date: ledgerDate,
        description: entry.notes || `${entry.paymentType === 'REGISTRATION' ? 'Registration' : 'Membership'} payment`,
        type: 'PAYMENT',
        amount: entry.amount,
        paymentMethod: entry.paymentMethod,
        createdAt: payment.createdAt,
        recordedBy: payment.receivedBy,
        paymentId: payment.id,
        idempotencyKey,
        billingMonth,
      };
      this.state.memberFeeLedger.push(ledgerEntry);
      this.recomputeLedgerBalances();
      if (member.balanceDue <= 0) {
        member.paymentStatus = 'PAID';
        if (member.status === 'PENDING_PAYMENT') {
          member.status = 'ACTIVE';
        }
      } else {
        member.paymentStatus = 'PARTIAL';
      }
      member.updatedAt = new Date().toISOString();
      payment.paymentStatus = member.paymentStatus;
      payment.balanceDue = member.balanceDue;
    }

    this.addAuditLog('FINANCE', 'Payment Received', `Collected Rs. ${payment.amount} from ${payment.memberName} (${payment.receiptNumber})`);
    try {
      this.persist();
    } catch (error) {
      this.state.payments.shift();
      if (ledgerEntry) {
        this.state.memberFeeLedger = this.state.memberFeeLedger.filter((entry) => entry.id !== ledgerEntry?.id);
      }
      if (member && previousMember) Object.assign(member, previousMember);
      this.state.auditLogs.shift();
      throw error;
    }
    return payment;
  }

  public recordExpense(entry: Omit<ExpenseRecord, 'id' | 'createdBy'>): ExpenseRecord {
    if (entry.paymentMethod !== 'Cash') {
      throw new Error('The Gym Town records cash transactions only.');
    }
    const expense: ExpenseRecord = {
      ...entry,
      id: `exp_${Date.now()}`,
      createdBy: this.state.currentUser.fullName,
    };
    this.state.expenses.unshift(expense);
    this.addAuditLog('FINANCE', 'Expense Logged', `Logged expense Rs. ${expense.amount}: ${expense.title}`);
    this.persist();
    return expense;
  }

  // --- WHATSAPP OPERATIONS ---

  public logNotification(entry: Omit<WhatsAppNotification, 'id' | 'createdAt'>): WhatsAppNotification {
    const newNotification: WhatsAppNotification = {
      ...entry,
      id: `notif_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(newNotification);
    this.persist();
    return newNotification;
  }

  public recordNotification(entry: Omit<WhatsAppNotification, 'id' | 'createdAt'>): WhatsAppNotification {
    return this.logNotification(entry);
  }

  public updateNotificationStatus(id: string, status: WhatsAppNotification['status']): void {
    const notif = this.state.notifications.find((n) => n.id === id);
    if (notif) {
      notif.status = status;
      if (status === 'SENT' || status === 'CLICK_TO_CHAT') {
        notif.sentAt = new Date().toISOString();
      }
      this.persist();
    }
  }

  // --- SETTINGS & AUDIT ---

  public updateSettings(updates: Partial<GymSettings>): void {
    for (const phone of [updates.phone, updates.whatsapp, updates.receptionistProfile?.phone]) {
      if (phone?.trim() && !this.isValidPhoneNumber(phone)) {
        throw new Error(INVALID_PHONE_NUMBER_ERROR);
      }
    }
    this.state.settings = { ...this.state.settings, ...updates };
    if (updates.receptionistProfile?.name) {
      this.state.currentUser.fullName = updates.receptionistProfile.name;
    }
    this.addAuditLog('SETTINGS', 'Settings Updated', 'Gym parameters updated for Hyderabad station');
    this.persist();
  }

  public addAuditLog(module: string, action: string, details: string): void {
    const log: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      userId: this.state.currentUser.id,
      username: this.state.currentUser.username,
      action,
      module,
      details,
    };
    this.state.auditLogs.unshift(log);
    if (this.state.auditLogs.length > 300) {
      this.state.auditLogs.pop();
    }
  }

  // ========================================================
  // --- INVENTORY & DAILY SALES (POS) MANAGEMENT ENGINE ---
  // ========================================================

  public getProducts(): Product[] {
    return [...(this.state.products || [])];
  }

  public getProductById(id: string): Product | undefined {
    return (this.state.products || []).find((p) => p.id === id);
  }

  public addProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
    const id = `prd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newProduct: Product = {
      ...productData,
      id,
      code: productData.code || `PRD-${(this.state.products.length + 1).toString().padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!Array.isArray(this.state.products)) {
      this.state.products = [];
    }
    this.state.products.unshift(newProduct);

    // Initial stock transaction if stock > 0
    if (newProduct.stockQuantity > 0) {
      this.recordInventoryTransaction({
        productId: newProduct.id,
        productName: newProduct.name,
        type: 'PURCHASE',
        quantityChange: newProduct.stockQuantity,
        previousStock: 0,
        newStock: newProduct.stockQuantity,
        reason: 'Initial stock intake upon product registration',
        referenceId: newProduct.code,
      });
    }

    this.addAuditLog('INVENTORY', 'Product Created', `Added product ${newProduct.name} (${newProduct.code}) with ${newProduct.stockQuantity} units`);
    this.persist();
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Product>): boolean {
    const product = this.getProductById(id);
    if (!product) return false;

    // If stock is directly edited here, log adjustment
    if (updates.stockQuantity !== undefined && updates.stockQuantity !== product.stockQuantity) {
      const diff = updates.stockQuantity - product.stockQuantity;
      this.recordInventoryTransaction({
        productId: product.id,
        productName: product.name,
        type: diff > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT',
        quantityChange: diff,
        previousStock: product.stockQuantity,
        newStock: updates.stockQuantity,
        reason: 'Manual stock edit in product settings',
      });
    }

    Object.assign(product, updates, { updatedAt: new Date().toISOString() });
    this.addAuditLog('INVENTORY', 'Product Updated', `Updated product ${product.name}`);
    this.persist();
    return true;
  }

  public deleteProduct(id: string): boolean {
    const index = this.state.products.findIndex((p) => p.id === id);
    if (index === -1) return false;
    const [removed] = this.state.products.splice(index, 1);
    this.addAuditLog('INVENTORY', 'Product Deleted', `Deleted product ${removed.name}`);
    this.persist();
    return true;
  }

  public adjustStock(
    productId: string,
    quantityChange: number,
    reason: string,
    type: 'ADJUSTMENT' | 'DAMAGED' | 'EXPIRED' = 'ADJUSTMENT'
  ): { success: boolean; newStock: number; message: string } {
    const product = this.getProductById(productId);
    if (!product) {
      return { success: false, newStock: 0, message: 'Product not found' };
    }

    const previousStock = product.stockQuantity;
    const newStock = Math.max(0, previousStock + quantityChange);

    product.stockQuantity = newStock;
    product.updatedAt = new Date().toISOString();

    this.recordInventoryTransaction({
      productId: product.id,
      productName: product.name,
      type,
      quantityChange,
      previousStock,
      newStock,
      reason,
    });

    this.addAuditLog('INVENTORY', 'Stock Adjusted', `${type}: ${product.name} changed by ${quantityChange} units (Reason: ${reason})`);
    this.persist();
    return { success: true, newStock, message: `Stock updated to ${newStock} units` };
  }

  public getInventoryTransactions(productId?: string): InventoryTransaction[] {
    const txs = this.state.inventoryTransactions || [];
    if (productId) {
      return txs.filter((t) => t.productId === productId);
    }
    return txs;
  }

  private recordInventoryTransaction(data: {
    productId: string;
    productName: string;
    type: StockMovementType;
    quantityChange: number;
    previousStock: number;
    newStock: number;
    reason?: string;
    referenceId?: string;
  }): void {
    if (!Array.isArray(this.state.inventoryTransactions)) {
      this.state.inventoryTransactions = [];
    }

    const operator = this.state.settings.receptionistProfile?.name || 'Bilal Tariq';
    this.state.inventoryTransactions.unshift({
      id: `itx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      productId: data.productId,
      productName: data.productName,
      type: data.type,
      quantityChange: data.quantityChange,
      previousStock: data.previousStock,
      newStock: data.newStock,
      reason: data.reason,
      referenceId: data.referenceId,
      operator,
      timestamp: new Date().toISOString(),
    });
  }

  // --- DAILY SALES & POINT OF SALE (POS) ---

  public getSales(): Sale[] {
    return [...(this.state.sales || [])];
  }

  public getSaleById(id: string): Sale | undefined {
    return (this.state.sales || []).find((s) => s.id === id);
  }

  public generateNextInvoiceNumber(): string {
    const salesCount = (this.state.sales?.length || 0) + 1;
    const year = new Date().getFullYear();
    return `TGT-POS-${year}-${salesCount.toString().padStart(4, '0')}`;
  }

  public recordSale(saleData: {
    items: { productId: string; quantity: number }[];
    discount?: number;
    paymentMethod: PaymentMethod;
    memberId?: string;
    memberRollNumber?: string;
    memberName?: string;
    notes?: string;
  }): { success: boolean; sale?: Sale; error?: string } {
    if (saleData.paymentMethod !== 'Cash') {
      return { success: false, error: 'The Gym Town accepts cash payments only.' };
    }
    if (!saleData.items || saleData.items.length === 0) {
      return { success: false, error: 'Sale must contain at least one item' };
    }

    // 1. Validate stock availability for all items before committing
    for (const item of saleData.items) {
      const product = this.getProductById(item.productId);
      if (!product) {
        return { success: false, error: `Product ID "${item.productId}" does not exist in inventory` };
      }
      if (item.quantity <= 0) {
        return { success: false, error: `Invalid quantity for ${product.name}` };
      }
      if (product.stockQuantity < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
        };
      }
    }

    // 2. Prepare Sale Items and calculate COGS & Gross Profit
    const invoiceNumber = this.generateNextInvoiceNumber();
    const operator = this.state.settings.receptionistProfile?.name || 'Bilal Tariq';
    const saleItems: SaleItem[] = [];
    let subtotal = 0;
    let totalCogs = 0;

    for (const item of saleData.items) {
      const product = this.getProductById(item.productId)!;
      const unitSellingPrice = product.sellingPrice;
      const unitPurchasePrice = product.purchasePrice; // snapshot of purchase cost
      const itemSubtotal = item.quantity * unitSellingPrice;
      const itemCogs = item.quantity * unitPurchasePrice;
      const itemProfit = itemSubtotal - itemCogs;

      subtotal += itemSubtotal;
      totalCogs += itemCogs;

      saleItems.push({
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        category: product.category,
        quantity: item.quantity,
        unitSellingPrice,
        unitPurchasePrice,
        subtotal: itemSubtotal,
        cogs: itemCogs,
        profit: itemProfit,
      });

      // 3. Deduct stock and record inventory transaction
      const previousStock = product.stockQuantity;
      const newStock = previousStock - item.quantity;
      product.stockQuantity = newStock;
      product.updatedAt = new Date().toISOString();

      this.recordInventoryTransaction({
        productId: product.id,
        productName: product.name,
        type: 'SALE',
        quantityChange: -item.quantity,
        previousStock,
        newStock,
        referenceId: invoiceNumber,
        reason: `POS Counter Sale (${invoiceNumber})`,
      });
    }

    const discount = Math.max(0, saleData.discount || 0);
    const totalAmount = Math.max(0, subtotal - discount);
    // Gross Profit = Sales Revenue - Cost of Goods Sold
    const grossProfit = totalAmount - totalCogs;

    const newSale: Sale = {
      id: `sale_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      invoiceNumber,
      items: saleItems,
      subtotal,
      discount,
      totalAmount,
      totalCogs,
      grossProfit,
      paymentMethod: saleData.paymentMethod,
      memberId: saleData.memberId,
      memberRollNumber: saleData.memberRollNumber,
      memberName: saleData.memberName || 'Walk-in Guest',
      notes: saleData.notes,
      soldBy: operator,
      createdAt: new Date().toISOString(),
      date: formatDate(new Date()),
    };

    if (!Array.isArray(this.state.sales)) {
      this.state.sales = [];
    }
    this.state.sales.unshift(newSale);

    this.addAuditLog(
      'POS',
      'Daily Sale Completed',
      `Invoice ${invoiceNumber}: Rs. ${totalAmount.toLocaleString()} (${saleItems.length} items sold by ${operator})`
    );

    this.persist();
    return { success: true, sale: newSale };
  }

  // --- PURCHASE & RESTOCKING ---

  public getStockPurchases(): StockPurchase[] {
    return [...(this.state.stockPurchases || [])];
  }

  public generateNextPurchaseNumber(): string {
    const poCount = (this.state.stockPurchases?.length || 0) + 1;
    const year = new Date().getFullYear();
    return `TGT-PO-${year}-${poCount.toString().padStart(4, '0')}`;
  }

  public recordStockPurchase(purchaseData: {
    supplierName: string;
    supplierContact?: string;
    items: { productId: string; quantity: number; unitPurchasePrice: number; expiryDate?: string }[];
    paymentMethod: PaymentMethod;
    purchaseDate: string;
    notes?: string;
  }): { success: boolean; purchase?: StockPurchase; error?: string } {
    if (purchaseData.paymentMethod !== 'Cash') {
      return { success: false, error: 'The Gym Town records cash transactions only.' };
    }
    if (!purchaseData.items || purchaseData.items.length === 0) {
      return { success: false, error: 'Purchase shipment must contain at least one product' };
    }

    const purchaseNumber = this.generateNextPurchaseNumber();
    const operator = this.state.settings.receptionistProfile?.name || 'Bilal Tariq';
    const purchaseItems: StockPurchaseItem[] = [];
    let totalCost = 0;

    for (const item of purchaseData.items) {
      const product = this.getProductById(item.productId);
      if (!product) continue;

      const itemTotal = item.quantity * item.unitPurchasePrice;
      totalCost += itemTotal;

      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPurchasePrice: item.unitPurchasePrice,
        totalCost: itemTotal,
        expiryDate: item.expiryDate,
      });

      // Update product stock and optionally weighted purchase price
      const previousStock = product.stockQuantity;
      const newStock = previousStock + item.quantity;

      // Weighted Average Cost calculation
      if (newStock > 0) {
        const currentTotalCost = previousStock * product.purchasePrice;
        const incomingCost = item.quantity * item.unitPurchasePrice;
        const weightedCost = Math.round((currentTotalCost + incomingCost) / newStock);
        product.purchasePrice = weightedCost;
      }

      product.stockQuantity = newStock;
      if (item.expiryDate) {
        product.expiryDate = item.expiryDate;
      }
      product.supplierName = purchaseData.supplierName;
      product.updatedAt = new Date().toISOString();

      this.recordInventoryTransaction({
        productId: product.id,
        productName: product.name,
        type: 'PURCHASE',
        quantityChange: item.quantity,
        previousStock,
        newStock,
        referenceId: purchaseNumber,
        reason: `Restocked from ${purchaseData.supplierName} (${purchaseNumber})`,
      });
    }

    const newPurchase: StockPurchase = {
      id: `po_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      purchaseNumber,
      supplierName: purchaseData.supplierName,
      supplierContact: purchaseData.supplierContact,
      items: purchaseItems,
      totalCost,
      paymentMethod: purchaseData.paymentMethod,
      purchaseDate: purchaseData.purchaseDate || formatDate(new Date()),
      notes: purchaseData.notes,
      receivedBy: operator,
      createdAt: new Date().toISOString(),
    };

    if (!Array.isArray(this.state.stockPurchases)) {
      this.state.stockPurchases = [];
    }
    this.state.stockPurchases.unshift(newPurchase);

    this.addAuditLog(
      'INVENTORY',
      'Stock Restocked',
      `PO ${purchaseNumber}: Restocked ${purchaseItems.length} products from ${purchaseData.supplierName} for Rs. ${totalCost.toLocaleString()}`
    );

    this.persist();
    return { success: true, purchase: newPurchase };
  }

  // --- SUPPLIERS DIRECTORY ---

  public getSuppliers(): Supplier[] {
    return [...(this.state.suppliers || [])];
  }

  public addSupplier(supplierData: Omit<Supplier, 'id'>): Supplier {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `sup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
    if (!Array.isArray(this.state.suppliers)) {
      this.state.suppliers = [];
    }
    this.state.suppliers.push(newSupplier);
    this.addAuditLog('INVENTORY', 'Supplier Added', `Added supplier ${newSupplier.name}`);
    this.persist();
    return newSupplier;
  }

  public deleteSupplier(id: string): boolean {
    const index = this.state.suppliers.findIndex((s) => s.id === id);
    if (index === -1) return false;
    const [removed] = this.state.suppliers.splice(index, 1);
    this.addAuditLog('INVENTORY', 'Supplier Removed', `Removed supplier ${removed.name}`);
    this.persist();
    return true;
  }

  // --- ALERTS & ANALYTICS ---

  public getLowStockProducts(): Product[] {
    return (this.state.products || []).filter(
      (p) => p.isActive && p.stockQuantity <= p.minStockLevel
    );
  }

  public getExpiredOrExpiringProducts(daysAhead: number = 30): Product[] {
    const today = formatDate(new Date());
    const limitDate = datePlus(daysAhead);
    return (this.state.products || []).filter((p) => {
      if (!p.isActive || !p.expiryDate) return false;
      return p.expiryDate <= limitDate;
    });
  }

  public getSalesMetrics(period: 'today' | 'week' | 'month' | 'all' = 'today'): {
    totalRevenue: number;
    totalQuantitySold: number;
    totalTransactions: number;
    totalCogs: number;
    grossProfit: number;
    profitMargin: number;
    cashSales: number;
    digitalSales: number;
    bestSellingProduct?: { name: string; quantity: number; revenue: number };
    productSales: {
      productId: string;
      productName: string;
      category: ProductCategory;
      quantitySold: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      remainingStock: number;
      status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    }[];
  } {
    const sales = this.state.sales || [];
    const todayStr = formatDate(new Date());
    const now = new Date();

    const filteredSales = sales.filter((s) => {
      if (period === 'all') return true;
      if (period === 'today') return s.date === todayStr;
      const saleDate = new Date(s.date);
      if (period === 'week') {
        const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }
      if (period === 'month') {
        return (
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });

    let totalRevenue = 0;
    let totalQuantitySold = 0;
    let totalCogs = 0;
    let cashSales = 0;
    let digitalSales = 0;

    const productSalesMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        category: ProductCategory;
        quantitySold: number;
        revenue: number;
        cogs: number;
      }
    >();

    for (const sale of filteredSales) {
      totalRevenue += sale.totalAmount;
      totalCogs += sale.totalCogs;

      if (sale.paymentMethod === 'Cash') {
        cashSales += sale.totalAmount;
      } else {
        digitalSales += sale.totalAmount;
      }

      for (const item of sale.items) {
        totalQuantitySold += item.quantity;
        const existing = productSalesMap.get(item.productId) || {
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          quantitySold: 0,
          revenue: 0,
          cogs: 0,
        };
        existing.quantitySold += item.quantity;
        existing.revenue += item.subtotal;
        existing.cogs += item.cogs;
        productSalesMap.set(item.productId, existing);
      }
    }

    const grossProfit = totalRevenue - totalCogs;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Find best seller
    let bestSellingProduct: { name: string; quantity: number; revenue: number } | undefined;
    let maxQty = 0;
    productSalesMap.forEach((p) => {
      if (p.quantitySold > maxQty) {
        maxQty = p.quantitySold;
        bestSellingProduct = {
          name: p.productName,
          quantity: p.quantitySold,
          revenue: p.revenue,
        };
      }
    });

    // Merge with current product stock for the report table
    const products = this.state.products || [];
    const productSales = products.map((prod) => {
      const soldData = productSalesMap.get(prod.id);
      const quantitySold = soldData ? soldData.quantitySold : 0;
      const revenue = soldData ? soldData.revenue : 0;
      const cogs = soldData ? soldData.cogs : 0;
      const profit = revenue - cogs;

      let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (prod.stockQuantity <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (prod.stockQuantity <= prod.minStockLevel) {
        status = 'LOW_STOCK';
      }

      return {
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        quantitySold,
        revenue,
        cogs,
        grossProfit: profit,
        remainingStock: prod.stockQuantity,
        status,
      };
    });

    // Sort report: products with sales first, then by remaining stock
    productSales.sort((a, b) => b.quantitySold - a.quantitySold);

    return {
      totalRevenue,
      totalQuantitySold,
      totalTransactions: filteredSales.length,
      totalCogs,
      grossProfit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      cashSales,
      digitalSales,
      bestSellingProduct,
      productSales,
    };
  }

  // --- BACKUP & RESTORE & FRESH START ---

  public clearAllData(): void {
    this.state.members = [];
    this.state.membershipHistory = [];
    this.state.attendance = [];
    this.state.payments = [];
    this.state.expenses = [];
    this.state.doorLogs = [];
    this.state.notifications = [];
    this.addAuditLog('SYSTEM', 'Clean Database Initialized', 'Cleared all member, attendance, and financial records for fresh start');
    this.persist();
  }

  public exportBackupJson(): string {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      software: 'The Gym Town Enterprise Desktop - Hyderabad Desk',
      version: '2.5.0-win64',
      database: this.state,
    };
    this.state.lastBackupDate = new Date().toISOString();
    this.addAuditLog('SYSTEM', 'Database Backup', 'Exported complete database JSON snapshot');
    this.persist();
    return JSON.stringify(payload, null, 2);
  }

  public restoreBackupJson(jsonString: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonString);
      const data = parsed.database || parsed;
      if (!data.members || !Array.isArray(data.members)) {
        return { success: false, message: 'Invalid backup file structure. Missing members table.' };
      }

      this.state = {
        ...this.state,
        members: data.members,
        plans: data.plans || this.state.plans,
        membershipHistory: data.membershipHistory || this.state.membershipHistory,
        attendance: data.attendance || this.state.attendance,
        payments: data.payments || this.state.payments,
        expenses: data.expenses || this.state.expenses,
        doorLogs: data.doorLogs || this.state.doorLogs,
        notifications: data.notifications || this.state.notifications,
        settings: data.settings || this.state.settings,
        lastBackupDate: new Date().toISOString(),
      };

      this.addAuditLog('SYSTEM', 'Database Restore', 'Successfully restored database from file backup');
      this.persist();
      return { success: true, message: `Successfully restored database (${data.members.length} members loaded).` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown parsing error';
      return { success: false, message: `Failed to restore database: ${msg}` };
    }
  }
}

export const db = new DatabaseManager();
