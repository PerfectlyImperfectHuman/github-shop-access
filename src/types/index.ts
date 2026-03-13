export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  type: "credit" | "payment";
  amount: number;
  description: string;
  date: string;
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
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalCredit: number;
  totalPayments: number;
  outstandingBalance: number;
  recentTransactions: Transaction[];
}
