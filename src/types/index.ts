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
  openingBalance: number; // amount we owe at start (positive = we owe them)
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

export type TransactionType = "credit" | "payment" | "sale" | "purchase" | "supplier_payment";

export interface Transaction {
  id: string;
  customerId: string;          // empty for supplier txns and pure cash sales
  supplierId?: string;         // set when partyType === "supplier"
  partyType?: "customer" | "supplier"; // defaults to "customer" for legacy data
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
  category: string;            // bijli, pani, safai, kiraya, transport, other
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
  shopType: "kiryana" | "pro" | "";
  printerWidth: "58mm" | "80mm";
}

export interface DailySummary {
  date: string;
  cashSales: number;
  creditGiven: number;
  paymentsReceived: number;
  purchases: number;            // ulta udhar received from suppliers
  supplierPayments: number;     // money paid to suppliers
  expenses: number;             // daily expenses
  salesCount: number;
  creditCount: number;
  paymentCount: number;
  purchaseCount: number;
  supplierPaymentCount: number;
  expenseCount: number;
}
