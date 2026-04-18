import Dexie, { type Table } from "dexie";
import type { Customer, Supplier, Transaction, Settings, Product, Expense, DailySummary } from "@/types";

class ShopDatabase extends Dexie {
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  transactions!: Table<Transaction, string>;
  settings!: Table<Settings, string>;
  products!: Table<Product, string>;
  expenses!: Table<Expense, string>;

  constructor() {
    super("ShopManagementDB");
    // v2 schema (existing users)
    this.version(2).stores({
      customers: "id, name, phone, isActive, createdAt, cnic",
      transactions: "id, customerId, type, date, createdAt, productId",
      settings: "id",
      products: "id, name, category, sku, isActive",
    });
    // v3 — add suppliers, expenses, partyType + supplierId index
    this.version(3).stores({
      customers: "id, name, phone, isActive, createdAt, cnic",
      suppliers: "id, name, phone, isActive, createdAt",
      transactions: "id, customerId, supplierId, partyType, type, date, createdAt, productId",
      settings: "id",
      products: "id, name, category, sku, isActive",
      expenses: "id, date, category, createdAt",
    }).upgrade(async tx => {
      // Backfill partyType on legacy transactions
      await tx.table("transactions").toCollection().modify(t => {
        if (!t.partyType) t.partyType = "customer";
      });
    });
  }
}

export const db = new ShopDatabase();

export async function initSettings(): Promise<Settings> {
  const existing = await db.settings.get("default");
  if (existing) {
    // Backfill new fields for users upgrading from v2
    const patched: Settings = {
      ...existing,
      language: (existing.language === "ur" ? "ur" : "en"),
      printerWidth: existing.printerWidth === "80mm" ? "80mm" : "58mm",
    };
    if (patched.printerWidth !== existing.printerWidth || patched.language !== existing.language) {
      await db.settings.put(patched);
    }
    return patched;
  }
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
    shopType: "",
    printerWidth: "58mm",
  };
  await db.settings.put(defaults);
  return defaults;
}

// ─── Customers ─────────────────────────────────────────────────────────────────
export async function addCustomer(c: Omit<Customer, "id" | "createdAt" | "updatedAt">): Promise<Customer> {
  const now = new Date().toISOString();
  const n: Customer = { ...c, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.customers.put(n);
  return n;
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
  const all = await db.customers.toArray();
  return activeOnly ? all.filter(c => c.isActive) : all;
}
export async function getCustomer(id: string): Promise<Customer | undefined> {
  return db.customers.get(id);
}
export async function getCustomerBalance(customerId: string): Promise<number> {
  const txns = await db.transactions.where("customerId").equals(customerId).toArray();
  return txns.reduce((bal, t) => {
    if (t.type === "credit") return bal + t.amount;
    if (t.type === "payment") return bal - t.amount;
    return bal;
  }, 0);
}

// ─── Suppliers ─────────────────────────────────────────────────────────────────
export async function addSupplier(s: Omit<Supplier, "id" | "createdAt" | "updatedAt">): Promise<Supplier> {
  const now = new Date().toISOString();
  const n: Supplier = { ...s, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.suppliers.put(n);
  return n;
}
export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<void> {
  await db.suppliers.update(id, { ...updates, updatedAt: new Date().toISOString() });
}
export async function deleteSupplier(id: string): Promise<void> {
  await db.transaction("rw", db.suppliers, db.transactions, async () => {
    await db.transactions.where("supplierId").equals(id).delete();
    await db.suppliers.delete(id);
  });
}
export async function getSuppliers(activeOnly = false): Promise<Supplier[]> {
  const all = await db.suppliers.toArray();
  return activeOnly ? all.filter(s => s.isActive) : all;
}
export async function getSupplier(id: string): Promise<Supplier | undefined> {
  return db.suppliers.get(id);
}
export async function getSupplierBalance(supplierId: string): Promise<number> {
  const [supplier, txns] = await Promise.all([
    db.suppliers.get(supplierId),
    db.transactions.where("supplierId").equals(supplierId).toArray(),
  ]);
  const opening = supplier?.openingBalance || 0;
  return txns.reduce((bal, t) => {
    if (t.type === "purchase") return bal + t.amount;
    if (t.type === "supplier_payment") return bal - t.amount;
    return bal;
  }, opening);
}
export async function getSupplierTransactions(supplierId: string): Promise<Transaction[]> {
  return db.transactions.where("supplierId").equals(supplierId).reverse().sortBy("date");
}

// ─── Products ──────────────────────────────────────────────────────────────────
export async function addProduct(p: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
  const now = new Date().toISOString();
  const n: Product = { ...p, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.products.put(n);
  return n;
}
export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  await db.products.update(id, { ...updates, updatedAt: new Date().toISOString() });
}
export async function deleteProduct(id: string): Promise<void> { await db.products.delete(id); }
export async function getProducts(activeOnly = false): Promise<Product[]> {
  const all = await db.products.toArray();
  return activeOnly ? all.filter(p => p.isActive) : all;
}
export async function getProduct(id: string): Promise<Product | undefined> { return db.products.get(id); }
export async function updateProductStock(id: string, delta: number): Promise<void> {
  const p = await db.products.get(id);
  if (p) await db.products.update(id, { stock: Math.max(0, p.stock + delta), updatedAt: new Date().toISOString() });
}

// ─── Transactions ──────────────────────────────────────────────────────────────
export async function addTransaction(txn: Omit<Transaction, "id" | "createdAt">): Promise<Transaction> {
  const partyType: Transaction["partyType"] =
    txn.partyType ?? (txn.type === "purchase" || txn.type === "supplier_payment" ? "supplier" : "customer");
  const n: Transaction = { ...txn, partyType, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await db.transactions.put(n);
  if (txn.productId && txn.quantity && txn.type === "credit") {
    await updateProductStock(txn.productId, -txn.quantity);
  }
  if (txn.productId && txn.quantity && txn.type === "purchase") {
    // Buying from supplier increases our stock
    await updateProductStock(txn.productId, txn.quantity);
  }
  return n;
}
export async function deleteTransaction(id: string): Promise<void> {
  const txn = await db.transactions.get(id);
  if (txn) {
    if (txn.productId && txn.quantity && txn.type === "credit") await updateProductStock(txn.productId, txn.quantity);
    if (txn.productId && txn.quantity && txn.type === "purchase") await updateProductStock(txn.productId, -txn.quantity);
    await db.transactions.delete(id);
  }
}
export async function getTransactions(customerId?: string): Promise<Transaction[]> {
  if (customerId) return db.transactions.where("customerId").equals(customerId).reverse().sortBy("date");
  return db.transactions.reverse().sortBy("date");
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
export async function addExpense(e: Omit<Expense, "id" | "createdAt">): Promise<Expense> {
  const n: Expense = { ...e, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await db.expenses.put(n);
  return n;
}
export async function deleteExpense(id: string): Promise<void> { await db.expenses.delete(id); }
export async function getExpenses(): Promise<Expense[]> {
  return db.expenses.reverse().sortBy("date");
}
export async function getExpensesByDate(dateStr: string): Promise<Expense[]> {
  const start = new Date(dateStr); start.setHours(0, 0, 0, 0);
  const end   = new Date(dateStr); end.setHours(23, 59, 59, 999);
  const all = await db.expenses.toArray();
  return all.filter(e => { const d = new Date(e.date); return d >= start && d <= end; });
}

// ─── Aggregates ────────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const [customers, transactions, products, suppliers] = await Promise.all([
    db.customers.toArray(),
    db.transactions.toArray(),
    db.products.toArray(),
    db.suppliers.toArray(),
  ]);

  const totalCredit   = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

  // Supplier outstanding (we owe them)
  let supplierOutstanding = 0;
  for (const s of suppliers) {
    const opening = s.openingBalance || 0;
    const txns = transactions.filter(t => t.supplierId === s.id);
    const bal = txns.reduce((b, t) => {
      if (t.type === "purchase") return b + t.amount;
      if (t.type === "supplier_payment") return b - t.amount;
      return b;
    }, opening);
    if (bal > 0) supplierOutstanding += bal;
  }

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const todayTxns = transactions.filter(t => new Date(t.date) >= today);
  const weekTxns  = transactions.filter(t => new Date(t.date) >= weekAgo);

  return {
    totalCustomers:    customers.length,
    activeCustomers:   customers.filter(c => c.isActive).length,
    totalSuppliers:    suppliers.length,
    totalCredit,
    totalPayments,
    outstandingBalance: totalCredit - totalPayments,
    supplierOutstanding,
    todayCredit:    todayTxns.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0),
    todayPayments:  todayTxns.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0),
    todayCashSales: todayTxns.filter(t => t.type === "sale").reduce((s, t) => s + t.amount, 0),
    weekCredit:   weekTxns.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0),
    weekPayments: weekTxns.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0),
    lowStockProducts: products.filter(p => p.isActive && p.stock <= p.minStock).length,
  };
}

export async function getDailySummary(dateStr: string): Promise<DailySummary> {
  const start = new Date(dateStr); start.setHours(0, 0, 0, 0);
  const end   = new Date(dateStr); end.setHours(23, 59, 59, 999);
  const [allTxns, allExpenses] = await Promise.all([db.transactions.toArray(), db.expenses.toArray()]);
  const day      = allTxns.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
  const dayExp   = allExpenses.filter(e => { const d = new Date(e.date); return d >= start && d <= end; });

  return {
    date: dateStr,
    cashSales:            day.filter(t => t.type === "sale").reduce((s, t) => s + t.amount, 0),
    creditGiven:          day.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0),
    paymentsReceived:     day.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0),
    purchases:            day.filter(t => t.type === "purchase").reduce((s, t) => s + t.amount, 0),
    supplierPayments:     day.filter(t => t.type === "supplier_payment").reduce((s, t) => s + t.amount, 0),
    expenses:             dayExp.reduce((s, e) => s + e.amount, 0),
    salesCount:           day.filter(t => t.type === "sale").length,
    creditCount:          day.filter(t => t.type === "credit").length,
    paymentCount:         day.filter(t => t.type === "payment").length,
    purchaseCount:        day.filter(t => t.type === "purchase").length,
    supplierPaymentCount: day.filter(t => t.type === "supplier_payment").length,
    expenseCount:         dayExp.length,
  };
}

// ─── Backup ────────────────────────────────────────────────────────────────────
export async function exportData(): Promise<string> {
  const [customers, suppliers, transactions, settings, products, expenses] = await Promise.all([
    db.customers.toArray(), db.suppliers.toArray(), db.transactions.toArray(),
    db.settings.toArray(), db.products.toArray(), db.expenses.toArray(),
  ]);
  return JSON.stringify(
    { customers, suppliers, transactions, settings, products, expenses, exportedAt: new Date().toISOString(), version: 3 },
    null, 2
  );
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction("rw", [db.customers, db.suppliers, db.transactions, db.settings, db.products, db.expenses], async () => {
    if (data.customers)    { await db.customers.clear();    await db.customers.bulkPut(data.customers); }
    if (data.suppliers)    { await db.suppliers.clear();    await db.suppliers.bulkPut(data.suppliers); }
    if (data.transactions) { await db.transactions.clear(); await db.transactions.bulkPut(data.transactions); }
    if (data.settings)     { await db.settings.clear();     await db.settings.bulkPut(data.settings); }
    if (data.products)     { await db.products.clear();     await db.products.bulkPut(data.products); }
    if (data.expenses)     { await db.expenses.clear();     await db.expenses.bulkPut(data.expenses); }
  });
}
