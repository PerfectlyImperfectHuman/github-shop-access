import Dexie, { type Table } from "dexie";
import type {
  Customer,
  Supplier,
  Transaction,
  Settings,
  Product,
  Expense,
  DailySummary,
  KistPlan,
  KistInstallment,
  KistStatus,
  Cheque,
  ChequeStatus,
} from "@/types";

// ── Sync queue record type ────────────────────────────────────────────────────

export interface SyncQueueItem {
  id: string; // composite: "{table}__{recordId}"
  table: string;
  recordId: string;
  data: Record<string, unknown>;
  op: "put" | "delete";
  timestamp: number;
  retries: number;
}

// ── Database ──────────────────────────────────────────────────────────────────

class ShopDatabase extends Dexie {
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  transactions!: Table<Transaction, string>;
  settings!: Table<Settings, string>;
  products!: Table<Product, string>;
  expenses!: Table<Expense, string>;
  kists!: Table<KistPlan, string>;
  kistInstallments!: Table<KistInstallment, string>;
  cheques!: Table<Cheque, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super("ShopManagementDB");
    // v2 schema (existing users)
    this.version(2).stores({
      customers: "id, name, phone, isActive, createdAt, cnic",
      transactions: "id, customerId, type, date, createdAt, productId",
      settings: "id",
      products: "id, name, category, sku, isActive",
    });
    // v3 — add suppliers, expenses
    this.version(3)
      .stores({
        customers: "id, name, phone, isActive, createdAt, cnic",
        suppliers: "id, name, phone, isActive, createdAt",
        transactions:
          "id, customerId, supplierId, partyType, type, date, createdAt, productId",
        settings: "id",
        products: "id, name, category, sku, isActive",
        expenses: "id, date, category, createdAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("transactions")
          .toCollection()
          .modify((t) => {
            if (!t.partyType) t.partyType = "customer";
          });
      });
    // v4 — add kist/installment tracking
    this.version(4).stores({
      customers: "id, name, phone, isActive, createdAt, cnic",
      suppliers: "id, name, phone, isActive, createdAt",
      transactions:
        "id, customerId, supplierId, partyType, type, date, createdAt, productId",
      settings: "id",
      products: "id, name, category, sku, isActive",
      expenses: "id, date, category, createdAt",
      kists: "id, customerId, status, createdAt",
      kistInstallments: "id, kistPlanId, customerId, dueDate, isPaid",
    });
    // v5 — add cheque management
    this.version(5).stores({
      customers: "id, name, phone, isActive, createdAt, cnic",
      suppliers: "id, name, phone, isActive, createdAt",
      transactions:
        "id, customerId, supplierId, partyType, type, date, createdAt, productId",
      settings: "id",
      products: "id, name, category, sku, isActive",
      expenses: "id, date, category, createdAt",
      kists: "id, customerId, status, createdAt",
      kistInstallments: "id, kistPlanId, customerId, dueDate, isPaid",
      cheques: "id, type, partyId, status, chequeDate, createdAt",
    });
    // v6 — add syncQueue for offline-first sync
    this.version(6).stores({
      customers: "id, name, phone, isActive, createdAt, cnic",
      suppliers: "id, name, phone, isActive, createdAt",
      transactions:
        "id, customerId, supplierId, partyType, type, date, createdAt, productId",
      settings: "id",
      products: "id, name, category, sku, isActive",
      expenses: "id, date, category, createdAt",
      kists: "id, customerId, status, createdAt",
      kistInstallments: "id, kistPlanId, customerId, dueDate, isPaid",
      cheques: "id, type, partyId, status, chequeDate, createdAt",
      syncQueue: "id, table, timestamp",
    });
  }
}

export const db = new ShopDatabase();

// ── Lazy sync import (avoids circular deps at module load time) ───────────────
// syncService imports db, so we import syncService lazily inside functions.

async function getSyncService() {
  return import("./syncService");
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function initSettings(): Promise<Settings> {
  const existing = await db.settings.get("default");
  if (existing) {
    const ex = existing as Partial<Settings> & Record<string, unknown>;
    const backfillPin = !("pinEnabled" in ex) || typeof ex.pinCode !== "string";
    const pinCode =
      typeof ex.pinCode === "string" && /^\d{0,4}$/.test(ex.pinCode)
        ? ex.pinCode
        : "";
    const patched: Settings = {
      ...existing,
      language: existing.language === "ur" ? "ur" : "en",
      printerWidth: existing.printerWidth === "80mm" ? "80mm" : "58mm",
      pinEnabled: ex.pinEnabled === true,
      pinCode,
    };
    if (
      patched.printerWidth !== existing.printerWidth ||
      patched.language !== existing.language ||
      backfillPin
    ) {
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
    pinEnabled: false,
    pinCode: "",
  };
  await db.settings.put(defaults);
  return defaults;
}

// ─── Customers ─────────────────────────────────────────────────────────────────

export async function addCustomer(
  c: Omit<Customer, "id" | "createdAt" | "updatedAt">,
): Promise<Customer> {
  const now = new Date().toISOString();
  const n: Customer = {
    ...c,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "customers",
    n as unknown as Record<string, unknown> & { id: string },
  );
  return n;
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>,
): Promise<void> {
  const existing = await db.customers.get(id);
  if (!existing) return;
  const updated: Customer = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "customers",
    updated as unknown as Record<string, unknown> & { id: string },
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  const { syncDelete } = await getSyncService();
  // Delete related transactions locally (they'll sync separately)
  const txns = await db.transactions.where("customerId").equals(id).toArray();
  await Promise.all(txns.map((t) => syncDelete("transactions", t.id)));
  await syncDelete("customers", id);
}

export async function getCustomers(activeOnly = false): Promise<Customer[]> {
  const all = await db.customers.toArray();
  return activeOnly ? all.filter((c) => c.isActive) : all;
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return db.customers.get(id);
}

export async function getCustomerBalance(customerId: string): Promise<number> {
  const txns = await db.transactions
    .where("customerId")
    .equals(customerId)
    .toArray();
  return txns.reduce((bal, t) => {
    if (t.type === "credit") return bal + t.amount;
    if (t.type === "payment") return bal - t.amount;
    return bal;
  }, 0);
}

// ─── Suppliers ─────────────────────────────────────────────────────────────────

export async function addSupplier(
  s: Omit<Supplier, "id" | "createdAt" | "updatedAt">,
): Promise<Supplier> {
  const now = new Date().toISOString();
  const n: Supplier = {
    ...s,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "suppliers",
    n as unknown as Record<string, unknown> & { id: string },
  );
  return n;
}

export async function updateSupplier(
  id: string,
  updates: Partial<Supplier>,
): Promise<void> {
  const existing = await db.suppliers.get(id);
  if (!existing) return;
  const updated: Supplier = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "suppliers",
    updated as unknown as Record<string, unknown> & { id: string },
  );
}

export async function deleteSupplier(id: string): Promise<void> {
  const { syncDelete } = await getSyncService();
  const txns = await db.transactions.where("supplierId").equals(id).toArray();
  await Promise.all(txns.map((t) => syncDelete("transactions", t.id)));
  await syncDelete("suppliers", id);
}

export async function getSuppliers(activeOnly = false): Promise<Supplier[]> {
  const all = await db.suppliers.toArray();
  return activeOnly ? all.filter((s) => s.isActive) : all;
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

export async function getSupplierTransactions(
  supplierId: string,
): Promise<Transaction[]> {
  return db.transactions
    .where("supplierId")
    .equals(supplierId)
    .reverse()
    .sortBy("date");
}

// ─── Products ──────────────────────────────────────────────────────────────────

export async function addProduct(
  p: Omit<Product, "id" | "createdAt" | "updatedAt">,
): Promise<Product> {
  const now = new Date().toISOString();
  const n: Product = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "products",
    n as unknown as Record<string, unknown> & { id: string },
  );
  return n;
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>,
): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) return;
  const updated: Product = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "products",
    updated as unknown as Record<string, unknown> & { id: string },
  );
}

export async function deleteProduct(id: string): Promise<void> {
  const { syncDelete } = await getSyncService();
  await syncDelete("products", id);
}

export async function getProducts(activeOnly = false): Promise<Product[]> {
  const all = await db.products.toArray();
  return activeOnly ? all.filter((p) => p.isActive) : all;
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function updateProductStock(
  id: string,
  delta: number,
): Promise<void> {
  const p = await db.products.get(id);
  if (!p) return;
  const updated: Product = {
    ...p,
    stock: Math.max(0, p.stock + delta),
    updatedAt: new Date().toISOString(),
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "products",
    updated as unknown as Record<string, unknown> & { id: string },
  );
}

// ─── Transactions ──────────────────────────────────────────────────────────────

export async function addTransaction(
  txn: Omit<Transaction, "id" | "createdAt">,
): Promise<Transaction> {
  const partyType: Transaction["partyType"] =
    txn.partyType ??
    (txn.type === "purchase" || txn.type === "supplier_payment"
      ? "supplier"
      : "customer");
  const n: Transaction = {
    ...txn,
    partyType,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "transactions",
    n as unknown as Record<string, unknown> & { id: string },
  );
  if (txn.productId && txn.quantity && txn.type === "credit") {
    await updateProductStock(txn.productId, -txn.quantity);
  }
  if (txn.productId && txn.quantity && txn.type === "purchase") {
    await updateProductStock(txn.productId, txn.quantity);
  }
  return n;
}

export async function deleteTransaction(id: string): Promise<void> {
  const txn = await db.transactions.get(id);
  if (!txn) return;
  // Reverse stock effects before deleting
  if (txn.productId && txn.quantity && txn.type === "credit")
    await updateProductStock(txn.productId, txn.quantity);
  if (txn.productId && txn.quantity && txn.type === "sale")
    await updateProductStock(txn.productId, txn.quantity);
  if (txn.productId && txn.quantity && txn.type === "purchase")
    await updateProductStock(txn.productId, -txn.quantity);
  const { syncDelete } = await getSyncService();
  await syncDelete("transactions", id);
}

export async function getTransactions(
  customerId?: string,
): Promise<Transaction[]> {
  if (customerId)
    return db.transactions
      .where("customerId")
      .equals(customerId)
      .reverse()
      .sortBy("date");
  return db.transactions.reverse().sortBy("date");
}

// ─── Expenses ──────────────────────────────────────────────────────────────────

export async function addExpense(
  e: Omit<Expense, "id" | "createdAt">,
): Promise<Expense> {
  const n: Expense = {
    ...e,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "expenses",
    n as unknown as Record<string, unknown> & { id: string },
  );
  return n;
}

export async function deleteExpense(id: string): Promise<void> {
  const { syncDelete } = await getSyncService();
  await syncDelete("expenses", id);
}

export async function getExpenses(): Promise<Expense[]> {
  return db.expenses.reverse().sortBy("date");
}

export async function getExpensesByDate(dateStr: string): Promise<Expense[]> {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  const all = await db.expenses.toArray();
  return all.filter((e) => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

// ─── Aggregates ────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [customers, transactions, products, suppliers] = await Promise.all([
    db.customers.toArray(),
    db.transactions.toArray(),
    db.products.toArray(),
    db.suppliers.toArray(),
  ]);

  const totalCredit = transactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions
    .filter((t) => t.type === "payment")
    .reduce((s, t) => s + t.amount, 0);

  let supplierOutstanding = 0;
  for (const s of suppliers) {
    const opening = s.openingBalance || 0;
    const txns = transactions.filter((t) => t.supplierId === s.id);
    const bal = txns.reduce((b, t) => {
      if (t.type === "purchase") return b + t.amount;
      if (t.type === "supplier_payment") return b - t.amount;
      return b;
    }, opening);
    if (bal > 0) supplierOutstanding += bal;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const todayTxns = transactions.filter((t) => new Date(t.date) >= today);
  const weekTxns = transactions.filter((t) => new Date(t.date) >= weekAgo);

  return {
    totalCustomers: customers.length,
    activeCustomers: customers.filter((c) => c.isActive).length,
    totalSuppliers: suppliers.length,
    totalCredit,
    totalPayments,
    outstandingBalance: totalCredit - totalPayments,
    supplierOutstanding,
    todayCredit: todayTxns
      .filter((t) => t.type === "credit")
      .reduce((s, t) => s + t.amount, 0),
    todayPayments: todayTxns
      .filter((t) => t.type === "payment")
      .reduce((s, t) => s + t.amount, 0),
    todayCashSales: todayTxns
      .filter((t) => t.type === "sale")
      .reduce((s, t) => s + t.amount, 0),
    weekCredit: weekTxns
      .filter((t) => t.type === "credit")
      .reduce((s, t) => s + t.amount, 0),
    weekPayments: weekTxns
      .filter((t) => t.type === "payment")
      .reduce((s, t) => s + t.amount, 0),
    lowStockProducts: products.filter(
      (p) => p.isActive && p.stock <= p.minStock,
    ).length,
  };
}

export async function getDailySummary(dateStr: string): Promise<DailySummary> {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  const [allTxns, allExpenses] = await Promise.all([
    db.transactions.toArray(),
    db.expenses.toArray(),
  ]);
  const day = allTxns.filter((t) => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
  const dayExp = allExpenses.filter((e) => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });

  return {
    date: dateStr,
    cashSales: day
      .filter((t) => t.type === "sale")
      .reduce((s, t) => s + t.amount, 0),
    creditGiven: day
      .filter((t) => t.type === "credit")
      .reduce((s, t) => s + t.amount, 0),
    paymentsReceived: day
      .filter((t) => t.type === "payment")
      .reduce((s, t) => s + t.amount, 0),
    purchases: day
      .filter((t) => t.type === "purchase")
      .reduce((s, t) => s + t.amount, 0),
    supplierPayments: day
      .filter((t) => t.type === "supplier_payment")
      .reduce((s, t) => s + t.amount, 0),
    expenses: dayExp.reduce((s, e) => s + e.amount, 0),
    salesCount: day.filter((t) => t.type === "sale").length,
    creditCount: day.filter((t) => t.type === "credit").length,
    paymentCount: day.filter((t) => t.type === "payment").length,
    purchaseCount: day.filter((t) => t.type === "purchase").length,
    supplierPaymentCount: day.filter((t) => t.type === "supplier_payment")
      .length,
    expenseCount: dayExp.length,
  };
}

// ─── Backup ────────────────────────────────────────────────────────────────────

export async function exportData(): Promise<string> {
  const [customers, suppliers, transactions, settings, products, expenses] =
    await Promise.all([
      db.customers.toArray(),
      db.suppliers.toArray(),
      db.transactions.toArray(),
      db.settings.toArray(),
      db.products.toArray(),
      db.expenses.toArray(),
    ]);
  return JSON.stringify(
    {
      customers,
      suppliers,
      transactions,
      settings,
      products,
      expenses,
      exportedAt: new Date().toISOString(),
      version: 3,
    },
    null,
    2,
  );
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction(
    "rw",
    [
      db.customers,
      db.suppliers,
      db.transactions,
      db.settings,
      db.products,
      db.expenses,
    ],
    async () => {
      if (data.customers) {
        await db.customers.clear();
        await db.customers.bulkPut(data.customers);
      }
      if (data.suppliers) {
        await db.suppliers.clear();
        await db.suppliers.bulkPut(data.suppliers);
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
      if (data.expenses) {
        await db.expenses.clear();
        await db.expenses.bulkPut(data.expenses);
      }
    },
  );
}

// ─── Kist / Installment Plans ───────────────────────────────────────────────

export async function addKistPlan(
  plan: Omit<KistPlan, "id" | "paidInstallments" | "status" | "createdAt">,
): Promise<KistPlan> {
  const planId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newPlan: KistPlan = {
    ...plan,
    id: planId,
    paidInstallments: 0,
    status: "active",
    createdAt: now,
  };

  const installments: KistInstallment[] = Array.from(
    { length: plan.totalInstallments },
    (_, i) => {
      const due = new Date(plan.startDate);
      if (plan.frequency === "weekly") due.setDate(due.getDate() + i * 7);
      if (plan.frequency === "biweekly") due.setDate(due.getDate() + i * 14);
      if (plan.frequency === "monthly") due.setMonth(due.getMonth() + i);

      const isLast = i === plan.totalInstallments - 1;
      const paidSoFar = plan.installmentAmount * i;
      const amount = isLast
        ? plan.totalAmount - paidSoFar
        : plan.installmentAmount;

      return {
        id: crypto.randomUUID(),
        kistPlanId: planId,
        customerId: plan.customerId,
        installmentNumber: i + 1,
        dueDate: due.toISOString(),
        amount,
        isPaid: false,
        createdAt: now,
      };
    },
  );

  const { syncPut } = await getSyncService();
  await syncPut(
    "kists",
    newPlan as unknown as Record<string, unknown> & { id: string },
  );
  await Promise.all(
    installments.map((inst) =>
      syncPut(
        "kistInstallments",
        inst as unknown as Record<string, unknown> & { id: string },
      ),
    ),
  );

  return newPlan;
}

export async function markInstallmentPaid(
  installmentId: string,
): Promise<void> {
  const inst = await db.kistInstallments.get(installmentId);
  if (!inst || inst.isPaid) return;

  const now = new Date().toISOString();
  const txnId = crypto.randomUUID();

  const paymentTxn: Transaction = {
    id: txnId,
    customerId: inst.customerId,
    partyType: "customer",
    type: "payment",
    amount: inst.amount,
    description: `Kist payment #${inst.installmentNumber}`,
    date: now,
    createdAt: now,
  };

  const { syncPut } = await getSyncService();

  // Update installment
  const updatedInst: KistInstallment = {
    ...inst,
    isPaid: true,
    paidDate: now,
    transactionId: txnId,
  };
  await syncPut(
    "kistInstallments",
    updatedInst as unknown as Record<string, unknown> & { id: string },
  );

  // Add payment transaction
  await syncPut(
    "transactions",
    paymentTxn as unknown as Record<string, unknown> & { id: string },
  );

  // Update plan progress
  const plan = await db.kists.get(inst.kistPlanId);
  if (plan) {
    const newPaid = plan.paidInstallments + 1;
    const newStatus: KistStatus =
      newPaid >= plan.totalInstallments ? "completed" : "active";
    const updatedPlan: KistPlan = {
      ...plan,
      paidInstallments: newPaid,
      status: newStatus,
    };
    await syncPut(
      "kists",
      updatedPlan as unknown as Record<string, unknown> & { id: string },
    );
  }
}

export async function deleteKistPlan(planId: string): Promise<void> {
  const { syncDelete } = await getSyncService();
  const installments = await db.kistInstallments
    .where("kistPlanId")
    .equals(planId)
    .toArray();
  await Promise.all(
    installments.map((i) => syncDelete("kistInstallments", i.id)),
  );
  await syncDelete("kists", planId);
}

export async function getOverdueInstallments(): Promise<KistInstallment[]> {
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const unpaid = await db.kistInstallments.toArray();
  return unpaid.filter((i) => !i.isPaid && new Date(i.dueDate) <= todayEnd);
}

// ─── Cheques ────────────────────────────────────────────────────────────────

export async function addCheque(
  c: Omit<Cheque, "id" | "createdAt" | "updatedAt">,
): Promise<Cheque> {
  const now = new Date().toISOString();
  const cheque: Cheque = {
    ...c,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "cheques",
    cheque as unknown as Record<string, unknown> & { id: string },
  );
  return cheque;
}

export async function updateChequeStatus(
  id: string,
  status: ChequeStatus,
): Promise<void> {
  const existing = await db.cheques.get(id);
  if (!existing) return;
  const updated: Cheque = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };
  const { syncPut } = await getSyncService();
  await syncPut(
    "cheques",
    updated as unknown as Record<string, unknown> & { id: string },
  );
}

export async function clearCheque(chequeId: string): Promise<void> {
  const cheque = await db.cheques.get(chequeId);
  if (!cheque || cheque.status === "cleared") return;

  const now = new Date().toISOString();
  const txnId = crypto.randomUUID();
  const { syncPut } = await getSyncService();

  if (cheque.partyId) {
    if (cheque.type === "received" && cheque.partyType === "customer") {
      await syncPut("transactions", {
        id: txnId,
        customerId: cheque.partyId,
        partyType: "customer",
        type: "payment",
        amount: cheque.amount,
        description: `Cheque cleared — #${cheque.chequeNo} (${cheque.bankName})`,
        date: now,
        createdAt: now,
      } as unknown as Record<string, unknown> & { id: string });
    } else if (cheque.type === "issued" && cheque.partyType === "supplier") {
      await syncPut("transactions", {
        id: txnId,
        customerId: "",
        supplierId: cheque.partyId,
        partyType: "supplier",
        type: "supplier_payment",
        amount: cheque.amount,
        description: `Cheque cleared — #${cheque.chequeNo} (${cheque.bankName})`,
        date: now,
        createdAt: now,
      } as unknown as Record<string, unknown> & { id: string });
    }
  }

  const updatedCheque: Cheque = {
    ...cheque,
    status: "cleared",
    clearedTransactionId: cheque.partyId ? txnId : undefined,
    updatedAt: now,
  };
  await syncPut(
    "cheques",
    updatedCheque as unknown as Record<string, unknown> & { id: string },
  );
}

export async function deleteCheque(id: string): Promise<void> {
  const { syncDelete } = await getSyncService();
  await syncDelete("cheques", id);
}
