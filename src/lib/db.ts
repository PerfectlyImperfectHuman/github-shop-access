import Dexie, { type Table } from "dexie";
import type { Customer, Transaction, Settings, Product } from "@/types";

class ShopDatabase extends Dexie {
  customers!: Table<Customer, string>;
  transactions!: Table<Transaction, string>;
  settings!: Table<Settings, string>;
  products!: Table<Product, string>;

  constructor() {
    super("ShopManagementDB");
    this.version(2).stores({
      customers: "id, name, phone, isActive, createdAt, cnic",
      transactions: "id, customerId, type, date, createdAt, productId",
      settings: "id",
      products: "id, name, category, sku, isActive",
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
    currency: "Rs.",
    shopName: "My Shop",
    ownerName: "",
    phone: "",
    address: "",
    autoBackup: true,
    darkMode: false,
    language: "en",
    taxRate: 0,
    receiptFooter: "Thank you for your business!",
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

export async function deleteCustomer(id: string): Promise<void> {
  await db.transaction("rw", db.customers, db.transactions, async () => {
    await db.transactions.where("customerId").equals(id).delete();
    await db.customers.delete(id);
  });
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

// Product operations
export async function addProduct(product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
  const now = new Date().toISOString();
  const newProduct: Product = {
    ...product,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.products.put(newProduct);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  await db.products.update(id, { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteProduct(id: string): Promise<void> {
  await db.products.delete(id);
}

export async function getProducts(activeOnly = false): Promise<Product[]> {
  if (activeOnly) {
    return db.products.where("isActive").equals(1).toArray();
  }
  return db.products.toArray();
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function updateProductStock(id: string, quantityChange: number): Promise<void> {
  const product = await db.products.get(id);
  if (product) {
    await db.products.update(id, {
      stock: product.stock + quantityChange,
      updatedAt: new Date().toISOString(),
    });
  }
}

// Transaction operations
export async function addTransaction(txn: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
  const newTxn: Transaction = {
    ...txn,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await db.transactions.put(newTxn);

  // Update product stock if linked
  if (txn.productId && txn.quantity && txn.type === "credit") {
    await updateProductStock(txn.productId, -txn.quantity);
  }

  return newTxn;
}

export async function deleteTransaction(id: string): Promise<void> {
  const txn = await db.transactions.get(id);
  if (txn) {
    // Restore stock if product-linked
    if (txn.productId && txn.quantity && txn.type === "credit") {
      await updateProductStock(txn.productId, txn.quantity);
    }
    await db.transactions.delete(id);
  }
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
  todayCredit: number;
  todayPayments: number;
  weekCredit: number;
  weekPayments: number;
  lowStockProducts: number;
}> {
  const customers = await db.customers.toArray();
  const transactions = await db.transactions.toArray();
  const products = await db.products.toArray();

  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const todayTxns = transactions.filter(t => new Date(t.date) >= today);
  const weekTxns = transactions.filter(t => new Date(t.date) >= weekAgo);

  const lowStockProducts = products.filter(p => p.isActive && p.stock <= p.minStock).length;

  return {
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.isActive).length,
    totalCredit,
    totalPayments,
    outstandingBalance: totalCredit - totalPayments,
    todayCredit: todayTxns.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0),
    todayPayments: todayTxns.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0),
    weekCredit: weekTxns.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0),
    weekPayments: weekTxns.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0),
    lowStockProducts,
  };
}

export async function exportData(): Promise<string> {
  const customers = await db.customers.toArray();
  const transactions = await db.transactions.toArray();
  const settings = await db.settings.toArray();
  const products = await db.products.toArray();
  return JSON.stringify({ customers, transactions, settings, products, exportedAt: new Date().toISOString(), version: 2 }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction("rw", db.customers, db.transactions, db.settings, db.products, async () => {
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
    if (data.products) {
      await db.products.clear();
      await db.products.bulkPut(data.products);
    }
  });
}
