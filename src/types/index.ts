export type MembershipStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'FROZEN' | 'PENDING_PAYMENT';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export type PaymentMethod = 'Cash';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type UserRole = 'SUPER_ADMIN' | 'GYM_OWNER' | 'MANAGER' | 'RECEPTIONIST' | 'TRAINER';
export type AccessStatus = 'GRANTED' | 'DENIED';
export type AttendanceMethod = 'MANUAL' | 'ID_SEARCH' | 'QR_SCAN' | 'CAMERA';

export interface MembershipPeriod {
  id: string;
  startDate: string;
  endDate?: string;
}

export interface Member {
  id: string;
  rollNumber: string; // e.g. TGT-2026-0001
  fullName: string;
  fatherName?: string;
  mobileNumber: string;
  whatsappNumber: string;
  email?: string;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup?: BloodGroup;
  dateOfBirth?: string;
  address?: string;
  registrationDate: string;
  membershipPeriods?: MembershipPeriod[];
  planId: string;
  planName: string;
  startDate: string;
  expiryDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes?: string;
  cnic?: string;
  lastReminderSentDate?: string;
  status: MembershipStatus;
  paymentStatus: PaymentStatus;
  totalFee: number;
  paidAmount: number;
  balanceDue: number;
  admissionFee?: number;
  monthlyFee?: number;
  billingMonths?: number;
  freezeHistory?: {
    id: string;
    freezeDate: string;
    resumeDate?: string;
    reason: string;
    daysFrozen?: number;
  }[];
  lastAttendanceDate?: string;
  totalVisits?: number;
  photoUrl?: string;
  archived: boolean;
  notes?: string;
  updatedAt: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  durationDays: number;
  durationMonths?: number;
  price: number; // PKR Rs.
  description: string;
  isActive: boolean;
  trainingType?: 'CARDIO' | 'MUSCLE_BUILDING' | 'CUSTOM';
  features?: string[];
}

export interface MembershipHistory {
  id: string;
  memberId: string;
  rollNumber: string;
  planId: string;
  planName: string;
  startDate: string;
  expiryDate: string;
  price: number;
  discount: number;
  finalPrice: number;
  paidAmount: number;
  actionType: 'NEW' | 'REJOIN' | 'RENEWAL' | 'EXTENSION' | 'FREEZE' | 'RESUME';
  createdAt: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  rollNumber: string;
  memberName: string;
  method: AttendanceMethod;
  accessStatus: AccessStatus;
  denialReason?: string;
  timestamp: string;
  checkInTime: string;
  checkOutTime?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  memberId: string;
  rollNumber: string;
  memberName: string;
  bloodGroup?: BloodGroup;
  amount: number;
  lateFee?: number;
  paymentMethod: PaymentMethod;
  paymentType: 'MEMBERSHIP' | 'REGISTRATION' | 'PERSONAL_TRAINING' | 'OTHER';
  paymentDate?: string;
  billingMonth?: string; // e.g. "2026-10" or "October 2026"
  totalFee?: number;
  balanceDue?: number;
  paymentStatus?: PaymentStatus;
  admissionFeePaid?: number;
  monthlyFeePaid?: number;
  notes?: string;
  receivedBy: string;
  createdAt: string;
}

export interface MemberFeeLedgerEntry {
  id: string;
  memberId: string;
  date: string;
  description: string;
  type: 'CHARGE' | 'PAYMENT';
  amount: number;
  paymentMethod: PaymentMethod | null;
  createdAt: string;
  recordedBy: string;
  paymentId?: string;
  idempotencyKey?: string;
  billingMonth?: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  category: 'Electricity' | 'Rent' | 'Equipment' | 'Maintenance' | 'Salaries' | 'Other';
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes?: string;
  createdBy: string;
}

export interface DoorAccessLog {
  id: string;
  memberId: string;
  rollNumber: string;
  memberName: string;
  method: string;
  status: AccessStatus;
  denialReason?: string;
  controllerDevice: string;
  timestamp: string;
}

export interface WhatsAppNotification {
  id: string;
  memberId: string;
  memberName: string;
  whatsappNumber: string;
  messageType: 'EXPIRY_3DAYS' | 'EXPIRED' | 'RENEWAL_CONFIRMATION' | 'PAYMENT_RECEIPT' | 'BALANCE_REMINDER' | 'ANNOUNCEMENT';
  messageText: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CLICK_TO_CHAT';
  createdAt: string;
  sentAt?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  email: string;
  isActive: boolean;
  lastLogin?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  module: string;
  details: string;
}

export interface ReceptionistProfile {
  name: string;
  phone: string;
  shift: string;
  counterId: string;
  notes?: string;
}

export interface GymSettings {
  gymName: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
  currency: string;
  timezone: string;
  taxNumber?: string;
  doorRelayEndpoint?: string;
  doorRelayPort?: string;
  doorOpenSeconds?: number;
  whatsappProvider: 'CLICK_TO_CHAT' | 'WHATSAPP_CLOUD_API' | 'TWILIO';
  whatsappApiKey?: string;
  whatsappPhoneNumberId?: string;
  autoBackupEnabled: boolean;
  backupFrequencyHours: number;
  logoUrl?: string;
  receptionistProfile: ReceptionistProfile;
}

// ==========================================
// INVENTORY & DAILY SALES MANAGEMENT ENTITIES
// ==========================================

export type ProductCategory =
  | 'Energy Drinks'
  | 'Protein Shakes'
  | 'Bottled Water'
  | 'Protein Bars'
  | 'Snacks'
  | 'Supplements'
  | 'Gym Accessories'
  | 'Other';

export interface Product {
  id: string;
  code: string; // e.g. "PRD-001" or Barcode
  name: string;
  category: ProductCategory;
  purchasePrice: number; // PKR Rs.
  sellingPrice: number; // PKR Rs.
  stockQuantity: number;
  minStockLevel: number;
  supplierName?: string;
  supplierId?: string;
  description?: string;
  unit?: string; // "Bottle", "Scoop", "Bar", "Piece", "Tub", "Pack"
  expiryDate?: string; // YYYY-MM-DD
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productCode: string;
  productName: string;
  category: ProductCategory;
  quantity: number;
  unitSellingPrice: number;
  unitPurchasePrice: number; // Snapshot of purchase cost at time of sale
  subtotal: number; // quantity * unitSellingPrice
  cogs: number; // quantity * unitPurchasePrice
  profit: number; // subtotal - cogs
}

export interface Sale {
  id: string;
  invoiceNumber: string; // e.g. "TGT-POS-001"
  items: SaleItem[];
  subtotal: number;
  discount: number;
  totalAmount: number; // subtotal - discount
  totalCogs: number; // Total Cost of Goods Sold
  grossProfit: number; // totalAmount - totalCogs
  paymentMethod: PaymentMethod;
  memberId?: string;
  memberRollNumber?: string;
  memberName?: string; // or "Walk-in Guest"
  notes?: string;
  soldBy: string; // Receptionist name
  createdAt: string;
  date: string; // YYYY-MM-DD
}

export interface StockPurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPurchasePrice: number;
  totalCost: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface StockPurchase {
  id: string;
  purchaseNumber: string; // e.g. "PO-2026-001"
  supplierName: string;
  supplierContact?: string;
  items: StockPurchaseItem[];
  totalCost: number;
  paymentMethod: PaymentMethod;
  purchaseDate: string; // YYYY-MM-DD
  notes?: string;
  receivedBy: string;
  createdAt: string;
}

export type StockMovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'DAMAGED' | 'EXPIRED' | 'RETURN';

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantityChange: number; // Negative for sale/damage/expired, positive for purchase/return
  previousStock: number;
  newStock: number;
  referenceId?: string; // invoiceNumber or purchaseNumber
  reason?: string;
  operator: string;
  timestamp: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  city?: string;
  address?: string;
  categoriesSupplied?: string[];
}
