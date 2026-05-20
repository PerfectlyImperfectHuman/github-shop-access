export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  isActive: boolean;
  creditLimit: number;
  cnic: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  isActive: boolean;
  openingBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  unit: string;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType =
  | "credit"
  | "payment"
  | "sale"
  | "purchase"
  | "supplier_payment";

export interface Transaction {
  id: string;
  customerId: string;
  supplierId?: string;
  partyType?: "customer" | "supplier";
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  productId?: string;
  quantity?: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
  createdAt: string;
}

export interface Settings {
  id: string;
  currency: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  autoBackup: boolean;
  darkMode: boolean;
  language: "en" | "ur";
  taxRate: number;
  receiptFooter: string;
  /**
   * Persisted mode value.
   * "kiryana" is kept in the union for IndexedDB backward compatibility —
   * existing rows written by v1 will have "kiryana" stored. At runtime,
   * normaliseMode() in modeConfig.ts converts it to "simple" before use.
   * New writes always use "simple" | "pro" | "advanced".
   */
  shopType: "simple" | "pro" | "advanced" | "kiryana" | "";
  printerWidth: "58mm" | "80mm";
  pinEnabled: boolean;
  pinCode: string;
}

export type KistFrequency = "weekly" | "biweekly" | "monthly";
export type KistStatus = "active" | "completed" | "cancelled";

export interface KistPlan {
  id: string;
  customerId: string;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  frequency: KistFrequency;
  startDate: string;
  description: string;
  status: KistStatus;
  createdAt: string;
}

export interface KistInstallment {
  id: string;
  kistPlanId: string;
  customerId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  paidDate?: string;
  transactionId?: string;
  createdAt: string;
}

export type ChequeStatus =
  | "pending"
  | "deposited"
  | "cleared"
  | "bounced"
  | "cancelled";
export type ChequeType = "received" | "issued";

export interface Cheque {
  id: string;
  type: ChequeType;
  partyName: string;
  partyId?: string;
  partyType?: "customer" | "supplier" | "other";
  amount: number;
  chequeNo: string;
  bankName: string;
  chequeDate: string;
  status: ChequeStatus;
  notes: string;
  clearedTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailySummary {
  date: string;
  cashSales: number;
  creditGiven: number;
  paymentsReceived: number;
  purchases: number;
  supplierPayments: number;
  expenses: number;
  salesCount: number;
  creditCount: number;
  paymentCount: number;
  purchaseCount: number;
  supplierPaymentCount: number;
  expenseCount: number;
}
