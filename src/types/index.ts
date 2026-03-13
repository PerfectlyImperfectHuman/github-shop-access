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
  customerId: string;        // empty string "" for cash sales (type === "sale")
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
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalCredit: number;
  totalPayments: number;
  outstandingBalance: number;
  recentTransactions: Transaction[];
  todayCredit: number;
  todayPayments: number;
  todayCashSales: number;
  weekCredit: number;
  weekPayments: number;
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
