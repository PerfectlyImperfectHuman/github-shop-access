import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Printer, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Wallet, ClipboardCheck, RefreshCw, MessageCircle, Plus, X, Trash2, Receipt,
} from "lucide-react";
<<<<<<< HEAD
import { liveQuery } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getDailySummary, addExpense, deleteExpense } from "@/lib/db";
=======
import {
  getDailySummary, initSettings, getTransactions, getCustomer,
  getExpensesByDate, addExpense, deleteExpense,
} from "@/lib/db";
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
import { formatCurrency, shareOnWhatsApp } from "@/lib/utils";
import { toast } from "sonner";
import { useT, useLanguage } from "@/contexts/LanguageContext";
import { SelectField } from "@/components/ui/select-field";
import type { DailySummary, Transaction, Expense } from "@/types";

interface EnrichedTxn extends Transaction { customerName?: string; }

export default function DailyClose() {
  const t = useT();
  const { printerWidth } = useLanguage();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
<<<<<<< HEAD
  const [refreshTick, setRefreshTick] = useState(0);
  const summary = useLiveQuery(
    () => liveQuery(async () => {
      void refreshTick;
      return getDailySummary(date);
    }),
    [date, refreshTick],
  );
  const settingsRow = useLiveQuery(() => db.settings.get("default"), []);
  const allTxns = useLiveQuery(() => db.transactions.toArray(), []);
  const allExpenses = useLiveQuery(() => db.expenses.toArray(), []);
  const expenses = useMemo(() => {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    return (allExpenses ?? []).filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  }, [allExpenses, date]);
  const transactions = useMemo(() => {
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const list = (allTxns ?? []).filter(txn => {
      const d = new Date(txn.date);
      return d >= dayStart && d <= dayEnd;
    });
    const custs = settingsRow ? undefined : undefined;
    return list;
  }, [allTxns, date, settingsRow]);
=======
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<EnrichedTxn[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shopName, setShopName] = useState("My Shop");
  const [shopPhone, setShopPhone] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("Thank you!");
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState("");
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
  const openingCashKey = `openingCash:${date}`;

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expCategory, setExpCategory] = useState("cat_bijli");
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");

  useEffect(() => { setOpeningCash(localStorage.getItem(openingCashKey) || ""); }, [date]);
  useEffect(() => {
    if (openingCash) localStorage.setItem(openingCashKey, openingCash);
    else localStorage.removeItem(openingCashKey);
  }, [openingCash]);

  async function load() {
    setLoading(true);
    const [s, settings, exps] = await Promise.all([
      getDailySummary(date), initSettings(), getExpensesByDate(date),
    ]);
    setSummary(s);
    setShopName(settings.shopName);
    setShopPhone(settings.phone || "");
    setReceiptFooter(settings.receiptFooter || "Thank you!");
    setExpenses(exps);

    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const allTxns  = await getTransactions();
<<<<<<< HEAD
    const dayTxns  = allTxns.filter(txn => { const d = new Date(txn.date); return d >= dayStart && d <= dayEnd; });
=======
    const dayTxns  = allTxns.filter(t => { const d = new Date(t.date); return d >= dayStart && d <= dayEnd; });
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
    const enriched = await Promise.all(dayTxns.map(async tt => {
      const c = tt.customerId ? await getCustomer(tt.customerId) : undefined;
      return { ...tt, customerName: c?.name };
    }));
    setTransactions(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, [date]);

  function shiftDate(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days);
    const n = d.toISOString().split("T")[0];
    if (n <= today) setDate(n);
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) { toast.error(t("amount_required")); return; }
    await addExpense({
      date: new Date(date).toISOString(),
      category: expCategory,
      amount: amt,
      note: expNote.trim(),
    });
    toast.success(t("expense_added"));
    setExpAmount(""); setExpNote(""); setShowExpenseForm(false);
    load();
  }

  async function handleDeleteExpense(id: string) {
    await deleteExpense(id);
    toast.success(t("expense_deleted"));
    load();
  }

  const opening     = parseFloat(openingCash) || 0;
  const cashSales   = summary?.cashSales || 0;
  const payments    = summary?.paymentsReceived || 0;
  const credit      = summary?.creditGiven || 0;
  const expensesTotal = summary?.expenses || 0;
  const supplierPayments = summary?.supplierPayments || 0;
  const closingCash = opening + cashSales + payments - expensesTotal - supplierPayments;
  const isToday     = date === today;

  const shortDate = new Date(date).toLocaleDateString("en-PK", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  const printDate = new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });

  // ── WhatsApp summary (Roman Urdu so it forwards cleanly) ──
  function sendWhatsApp() {
    const lines = [
      `📊 ${shopName} — Daily Close`,
      `📅 ${printDate}`,
      ``,
      `💵 Cash Sales: Rs. ${cashSales.toLocaleString()}`,
      `💰 Payments (Wapsi): Rs. ${payments.toLocaleString()}`,
      `📒 Udhar Diya: Rs. ${credit.toLocaleString()}`,
      `🧾 Expenses: Rs. ${expensesTotal.toLocaleString()}`,
      ...(supplierPayments > 0 ? [`🚚 Supplier Paid: Rs. ${supplierPayments.toLocaleString()}`] : []),
      ``,
      `🪙 Opening Cash: Rs. ${opening.toLocaleString()}`,
      `✅ Closing Cash: Rs. ${closingCash.toLocaleString()}`,
      ``,
      `Bahi — Digital Khata`,
    ];
    shareOnWhatsApp(lines.join("\n"));
  }

  const expenseCategories = [
    { value: "cat_bijli", label: t("cat_bijli") },
    { value: "cat_pani", label: t("cat_pani") },
    { value: "cat_safai", label: t("cat_safai") },
    { value: "cat_kiraya", label: t("cat_kiraya") },
    { value: "cat_transport", label: t("cat_transport") },
    { value: "cat_salary", label: t("cat_salary") },
    { value: "cat_other", label: t("cat_other") },
  ];

  // Receipt sizing class — picks 58mm or 80mm via CSS print rules
  const receiptCls = printerWidth === "80mm" ? "receipt-80" : "receipt-58";

  return (
    <>
      {/* Print-only closing report */}
      <div className="receipt-print-area hidden print:block">
        <div className={receiptCls} style={{ fontFamily: "monospace", fontSize: "11px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <div className="receipt-title" style={{ fontSize: "14px", fontWeight: "bold" }}>{shopName}</div>
            {shopPhone && <div style={{ fontSize: "10px" }}>{shopPhone}</div>}
            <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "6px" }}>{t("daily_close_report")}</div>
            <div style={{ fontSize: "10px" }}>{printDate}</div>
            <div style={{ fontSize: "9px", color: "#555" }}>Printed: {printTime}</div>
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {[
            ["Opening Cash",                         `Rs. ${opening.toLocaleString()}`],
            [`Cash Sales (${summary?.salesCount || 0})`,    `+ Rs. ${cashSales.toLocaleString()}`],
            [`Payments (${summary?.paymentCount || 0})`,    `+ Rs. ${payments.toLocaleString()}`],
            [`Expenses (${summary?.expenseCount || 0})`,    `− Rs. ${expensesTotal.toLocaleString()}`],
            ...(supplierPayments > 0 ? [[`Supplier Paid`, `− Rs. ${supplierPayments.toLocaleString()}`]] : []),
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
              <span>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
          <div className="receipt-total" style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px" }}>
            <span>CLOSING CASH</span><span>Rs. {closingCash.toLocaleString()}</span>
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>Udhar Given ({summary?.creditCount || 0})</span><span>Rs. {credit.toLocaleString()}</span>
          </div>
          {expenses.length > 0 && (
            <>
              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
              <div style={{ fontWeight: "bold", fontSize: "10px", marginBottom: "3px" }}>EXPENSES</div>
              {expenses.map(e => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", marginBottom: "1px" }}>
                  <span>{e.category.replace("cat_", "")}{e.note ? ` (${e.note})` : ""}</span>
                  <span>Rs. {e.amount.toLocaleString()}</span>
                </div>
              ))}
            </>
          )}
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ textAlign: "center", fontSize: "9px" }}>{receiptFooter}</div>
          <div style={{ textAlign: "center", fontSize: "8px", marginTop: "3px", color: "#888" }}>Bahi — Digital Khata</div>
        </div>
      </div>

      {/* Main UI */}
      <div className="space-y-4 animate-fade-in print:hidden max-w-lg mx-auto">
        {/* Date navigator */}
        <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2.5 shadow-sm">
          <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{shortDate}</p>
            {isToday && <p className="text-[11px] text-primary font-medium leading-none mt-0.5">{t("today")}</p>}
          </div>
          <button onClick={() => shiftDate(1)} disabled={isToday}
            className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground disabled:opacity-30 shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
            className="w-[130px] px-2.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
          />
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <label className="block text-xs font-medium text-muted-foreground mb-2">{t("opening_cash")}</label>
              <input type="number" placeholder="0" value={openingCash} onChange={e => setOpeningCash(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground text-2xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring" />
              <p className="text-xs text-muted-foreground mt-1.5">{t("opening_cash_hint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t("cash_sales"),         value: cashSales,  count: summary?.salesCount,   icon: Wallet,       color: "text-primary",     bg: "bg-primary/10" },
                { label: t("payments_received"),  value: payments,   count: summary?.paymentCount, icon: TrendingDown, color: "text-success",     bg: "bg-success/10" },
              ].map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium leading-tight pr-1">{c.label}</p>
                    <div className={`p-1.5 rounded-lg ${c.bg} shrink-0`}>
                      <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                    </div>
                  </div>
                  <p className={`text-xl font-display font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.count ?? 0}</p>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{t("credit_given")}</p>
                <p className="text-xl font-display font-bold text-destructive mt-0.5">{formatCurrency(credit)}</p>
                <p className="text-[11px] text-muted-foreground">{summary?.creditCount ?? 0}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-destructive/10"><TrendingUp className="w-5 h-5 text-destructive" /></div>
            </motion.div>

            {/* Expenses Section */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-display font-semibold text-sm text-card-foreground">
                    {t("expenses")} <span className="text-muted-foreground font-normal">— {formatCurrency(expensesTotal)}</span>
                  </h3>
                </div>
                <button onClick={() => setShowExpenseForm(s => !s)}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {t("add_expense")}
                </button>
              </div>
              {showExpenseForm && (
                <form onSubmit={handleAddExpense} className="p-4 border-b border-border bg-muted/20 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField value={expCategory} onValueChange={setExpCategory} options={expenseCategories} />
                    <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)}
                      placeholder={t("expense_amount")} required
                      className="px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <input value={expNote} onChange={e => setExpNote(e.target.value)} placeholder={t("expense_note")}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition">
                      {t("save")}
                    </button>
                    <button type="button" onClick={() => setShowExpenseForm(false)} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium">
                      {t("cancel")}
                    </button>
                  </div>
                </form>
              )}
              {expenses.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">{t("no_expenses")}</div>
              ) : (
                <div className="divide-y divide-border">
                  {expenses.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium shrink-0">
                        {t(e.category as any) || e.category}
                      </span>
                      <p className="text-sm text-card-foreground truncate flex-1">{e.note || "—"}</p>
                      <p className="text-sm font-mono font-semibold text-warning shrink-0">{formatCurrency(e.amount)}</p>
                      <button onClick={() => handleDeleteExpense(e.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Register Summary */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-semibold text-sm text-card-foreground">{t("register_summary")}</h3>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  [t("opening_cash"), formatCurrency(opening), "text-foreground"],
                  [`+ ${t("cash_sales")}`, formatCurrency(cashSales), "text-primary"],
                  [`+ ${t("payments_received")}`, formatCurrency(payments), "text-success"],
                  [`− ${t("expenses")}`, formatCurrency(expensesTotal), "text-warning"],
                  ...(supplierPayments > 0 ? [[`− ${t("supplier_payment")}`, formatCurrency(supplierPayments), "text-warning"]] : []),
                ].map(([k, v, cls]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{k}</span>
                    <span className={`font-mono font-medium ${cls}`}>{v}</span>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-card-foreground">{t("closing_cash")}</span>
                  <span className="font-display font-bold text-xl text-primary font-mono">{formatCurrency(closingCash)}</span>
                </div>
              </div>
            </motion.div>

            {transactions.length > 0 && (
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="font-display font-semibold text-sm text-card-foreground">
                    {transactions.length} {transactions.length !== 1 ? t("transactions") : t("transaction")}
                  </h3>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {transactions.map(tt => (
                    <div key={tt.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        tt.type === "sale"    ? "bg-primary/10 text-primary"
                        : tt.type === "credit" ? "bg-destructive/10 text-destructive"
                        : tt.type === "purchase" ? "bg-warning/10 text-warning"
                        : "bg-success/10 text-success"
                      }`}>
                        {tt.type === "sale" ? t("cash_sale") : tt.type === "credit" ? t("udhar_credit") : tt.type === "purchase" ? t("purchase") : t("payment_wapsi")}
                      </span>
                      <p className="text-sm text-card-foreground truncate flex-1">
                        {tt.customerName || tt.description?.slice(0, 28) || "—"}
                      </p>
                      <p className={`text-sm font-mono font-semibold shrink-0 ${
                        tt.type === "sale" ? "text-primary"
                        : tt.type === "credit" || tt.type === "purchase" ? "text-destructive"
                        : "text-success"
                      }`}>
                        {tt.type === "payment" || tt.type === "supplier_payment" ? "−" : "+"}{formatCurrency(tt.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={sendWhatsApp}
                style={{ backgroundColor: "#25D366", color: "white" }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition">
                <MessageCircle className="w-4 h-4" /> {t("whatsapp_summary")}
              </button>
              <button onClick={() => window.print()}
                className="flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition">
                <Printer className="w-4 h-4" /> {t("print")}
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">{t("whatsapp_summary_sub")}</p>
          </>
        )}
      </div>
    </>
  );
}
