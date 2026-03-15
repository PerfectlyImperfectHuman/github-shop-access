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

export interface Transaction {
  id: string;
  customerId: string;
  type: "credit" | "payment" | "sale";
  amount: number;
  description: string;
  date: string;
  productId?: string;
  quantity?: number;
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
  language: string;
  taxRate: number;
  receiptFooter: string;
  shopType: "kiryana" | "pro" | "";
}

export interface DailySummary {
  date: string;
  cashSales: number;
  creditGiven: number;
  paymentsReceived: number;
  salesCount: number;
  creditCount: number;
  paymentCount: number;
}
