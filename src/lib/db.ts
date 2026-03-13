import Dexie, { type Table } from "dexie";
import type { Customer, Transaction, Settings } from "@/types";

class ShopDatabase extends Dexie {
  customers!: Table<Customer, string>;
  transactions!: Table<Transaction, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("ShopManagementDB");
    this.version(1).stores({
      customers: "id, name, phone, isActive, createdAt",
      transactions: "id, customerId, type, date, createdAt",
      settings: "id",
    });
  }
}

export const db = new ShopDatabase();

// Initialize default settings
export async function initSettings(): Promise<Settings> {
  const existing = await db.settings.get("default");
  if (existing) return existing;

  const defaults: Settings = {
    id: "default",
    currency: "₹",
    shopName: "My Shop",
    ownerName: "",
    phone: "",
    address: "",
    autoBackup: true,
  };
  await db.settings.put(defaults);
  return defaults;
}

// Customer operations
export async function addCustomer(customer: Omit<Customer, "id" | "createdAt" | "updatedAt">): Promise<Customer> {
  const now = new Date().toISOString();
  const newCustomer: Customer = {
    ...customer,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.customers.put(newCustomer);
  return newCustomer;
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
  await db.customers.update(id, { ...updates, updatedAt: new Date().toISOString() });
}

export async function getCustomers(activeOnly = false): Promise<Customer[]> {
  if (activeOnly) {
    return db.customers.where("isActive").equals(1).toArray();
  }
  return db.customers.toArray();
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return db.customers.get(id);
}

export async function getCustomerBalance(customerId: string): Promise<number> {
  const txns = await db.transactions.where("customerId").equals(customerId).toArray();
  return txns.reduce((bal, t) => bal + (t.type === "credit" ? t.amount : -t.amount), 0);
}

// Transaction operations
export async function addTransaction(txn: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
  const newTxn: Transaction = {
    ...txn,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await db.transactions.put(newTxn);
  return newTxn;
}

export async function getTransactions(customerId?: string): Promise<Transaction[]> {
  if (customerId) {
    return db.transactions.where("customerId").equals(customerId).reverse().sortBy("date");
  }
  return db.transactions.reverse().sortBy("date");
}

export async function getDashboardStats(): Promise<{
  totalCustomers: number;
  activeCustomers: number;
  totalCredit: number;
  totalPayments: number;
  outstandingBalance: number;
}> {
  const customers = await db.customers.toArray();
  const transactions = await db.transactions.toArray();

  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

  return {
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.isActive).length,
    totalCredit,
    totalPayments,
    outstandingBalance: totalCredit - totalPayments,
  };
}

export async function exportData(): Promise<string> {
  const customers = await db.customers.toArray();
  const transactions = await db.transactions.toArray();
  const settings = await db.settings.toArray();
  return JSON.stringify({ customers, transactions, settings, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction("rw", db.customers, db.transactions, db.settings, async () => {
    if (data.customers) {
      await db.customers.clear();
      await db.customers.bulkPut(data.customers);
    }
    if (data.transactions) {
      await db.transactions.clear();
      await db.transactions.bulkPut(data.transactions);
    }
    if (data.settings) {
      await db.settings.clear();
      await db.settings.bulkPut(data.settings);
    }
  });
}
