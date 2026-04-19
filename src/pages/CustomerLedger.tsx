import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Printer,
  User,
  Wallet,
  MessageCircle,
  PlusCircle,
  Trash2,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";
import {
  db,
  deleteTransaction,
  addKistPlan,
  markInstallmentPaid,
  deleteKistPlan,
} from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Customer, Transaction, KistFrequency } from "@/types";

interface LedgerRow extends Transaction {
  runningBalance: number;
}

const today = new Date().toISOString().split("T")[0];
const emptyKistForm = {
  totalAmount: "",
  count: "6",
  frequency: "monthly" as KistFrequency,
  startDate: today,
  description: "",
};

export default function CustomerLedger() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── Ledger data ─────────────────────────────────────────────────────────
  const ledger = useLiveQuery(async () => {
    if (!id)
      return {
        customer: null as Customer | null,
        transactions: [] as Transaction[],
        balance: 0,
      };
    const [c, txns] = await Promise.all([
      db.customers.get(id),
      db.transactions.where("customerId").equals(id).toArray(),
    ]);
    const sorted = [...txns].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const bal = sorted.reduce((b, tr) => {
      if (tr.type === "credit") return b + tr.amount;
      if (tr.type === "payment") return b - tr.amount;
      return b;
    }, 0);
    return { customer: c ?? null, transactions: sorted, balance: bal };
  }, [id]);

  // ── Kist data ────────────────────────────────────────────────────────────
  const kistData = useLiveQuery(async () => {
    if (!id) return { plans: [], installments: [] };
    const plans = await db.kists.where("customerId").equals(id).toArray();
    const planIds = plans.map((p) => p.id);
    const installments =
      planIds.length > 0
        ? await db.kistInstallments.where("kistPlanId").anyOf(planIds).toArray()
        : [];
    return {
      plans: plans.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      installments,
    };
  }, [id]);

  const customer = ledger?.customer ?? null;
  const transactions = ledger?.transactions ?? [];
  const balance = ledger?.balance ?? 0;
  const kistPlans = kistData?.plans ?? [];
  const kistInsts = kistData?.installments ?? [];
  const loading = !id || ledger === undefined || kistData === undefined;

  // ── State ────────────────────────────────────────────────────────────────
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);
  const [showKistForm, setShowKistForm] = useState(false);
  const [kistForm, setKistForm] = useState(emptyKistForm);
  const [kistSubmitting, setKistSubmitting] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  const installmentPreview =
    kistForm.totalAmount && kistForm.count
      ? Math.round(parseFloat(kistForm.totalAmount) / parseInt(kistForm.count))
      : 0;

  const nowMs = Date.now();

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function confirmDeleteTransaction() {
    if (!deleteTxnId) return;
    await deleteTransaction(deleteTxnId);
    toast.success(t("txn_deleted"));
    setDeleteTxnId(null);
  }

  function handleWhatsApp() {
    if (!customer?.phone) {
      toast.error(t("no_phone_saved"));
      return;
    }
    const digits = customer.phone.replace(/\D/g, "");
    const intl = digits.startsWith("0")
      ? "92" + digits.slice(1)
      : digits.startsWith("92")
        ? digits
        : "92" + digits;
    const balMsg =
      balance > 0
        ? `Aapka balance Rs. ${balance.toLocaleString()} baaki hai.`
        : balance < 0
          ? `Aapka advance Rs. ${Math.abs(balance).toLocaleString()} hai.`
          : "Aapka account bilkul theek hai (settled).";
    const msg = `Assalam u Alaikum ${customer.name}!\n\n${balMsg}\n\nShukriya apni dukaan par trust karne ka! 🙏`;
    window.open(
      `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  }

  async function handleKistSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = parseFloat(kistForm.totalAmount);
    const count = parseInt(kistForm.count);
    if (!total || total <= 0) {
      toast.error("Please enter a valid total amount");
      return;
    }
    if (!count || count < 2) {
      toast.error("Minimum 2 installments required");
      return;
    }
    if (!id) return;
    setKistSubmitting(true);
    try {
      await addKistPlan({
        customerId: id,
        totalAmount: total,
        installmentAmount: Math.round(total / count),
        totalInstallments: count,
        frequency: kistForm.frequency,
        startDate: new Date(kistForm.startDate).toISOString(),
        description: kistForm.description.trim(),
      });
      toast.success("Kist plan created ✓");
      setShowKistForm(false);
      setKistForm(emptyKistForm);
    } catch {
      toast.error("Failed to create kist plan");
    } finally {
      setKistSubmitting(false);
    }
  }

  async function handleMarkPaid(installmentId: string) {
    try {
      await markInstallmentPaid(installmentId);
      toast.success("Installment marked as paid ✓");
    } catch {
      toast.error("Failed to mark as paid");
    }
  }

  async function confirmDeletePlan() {
    if (!deletePlanId) return;
    await deleteKistPlan(deletePlanId);
    toast.success("Kist plan deleted");
    if (expandedPlanId === deletePlanId) setExpandedPlanId(null);
    setDeletePlanId(null);
  }

  // ── Guards ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t("customer_not_found")}</p>
        <button
          onClick={() => navigate("/customers")}
          className="mt-4 text-primary hover:underline text-sm"
        >
          ← {t("back_to_customers")}
        </button>
      </div>
    );
  }

  // Running balance calc
  const reversedTxns = [...transactions].reverse();
  let running = 0;
  const ledgerRows: LedgerRow[] = reversedTxns
    .map((txn) => {
      running += txn.type === "credit" ? txn.amount : -txn.amount;
      return { ...txn, runningBalance: running };
    })
    .reverse();

  const totalCredit = transactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions
    .filter((t) => t.type === "payment")
    .reduce((s, t) => s + t.amount, 0);
  const totalOverdue = kistInsts.filter(
    (i) => !i.isPaid && new Date(i.dueDate).getTime() <= nowMs,
  ).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition no-print"
      >
        <ArrowLeft className="w-4 h-4" /> {t("back_to_customers")}
      </button>

      {/* Customer Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-5 shadow-sm print-area"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-card-foreground">
                {customer.name}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {customer.phone}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {customer.address}
                  </span>
                )}
                {customer.cnic && <span>CNIC: {customer.cnic}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print flex-wrap">
            {customer.phone && (
              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-600 text-sm font-medium hover:bg-green-500/20 transition"
              >
                <MessageCircle className="w-4 h-4" /> {t("whatsapp")}
              </button>
            )}
            <button
              onClick={() =>
                navigate(
                  `/new-transaction?type=payment&customer=${customer.id}`,
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition"
            >
              <PlusCircle className="w-4 h-4" /> {t("record_payment")}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:opacity-90 transition"
            >
              <Printer className="w-4 h-4" /> {t("print")}
            </button>
          </div>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="p-3 rounded-lg bg-destructive/10">
            <p className="text-xs text-muted-foreground">
              {t("total_credit_label")}
            </p>
            <p className="text-base font-display font-bold text-destructive">
              {formatCurrency(totalCredit)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">{t("total_paid")}</p>
            <p className="text-base font-display font-bold text-success">
              {formatCurrency(totalPayments)}
            </p>
          </div>
          <div
            className={`p-3 rounded-lg ${balance > 0 ? "bg-warning/10" : "bg-success/10"}`}
          >
            <p className="text-xs text-muted-foreground">{t("balance")}</p>
            <p
              className={`text-base font-display font-bold ${balance > 0 ? "text-warning" : "text-success"}`}
            >
              {balance > 0
                ? formatCurrency(balance)
                : balance < 0
                  ? `${formatCurrency(Math.abs(balance))} ${t("advance")}`
                  : `${t("settled")} ✓`}
            </p>
          </div>
        </div>

        {customer.creditLimit > 0 && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-muted flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              {t("credit_limit")}:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(customer.creditLimit)}
              </span>
              {balance > customer.creditLimit ? (
                <span className="text-destructive font-semibold ml-2">
                  ⚠ {t("exceeded_by")}{" "}
                  {formatCurrency(balance - customer.creditLimit)}
                </span>
              ) : (
                <span className="text-success font-semibold ml-2">
                  {t("available")}:{" "}
                  {formatCurrency(customer.creditLimit - Math.max(0, balance))}
                </span>
              )}
            </p>
          </div>
        )}
      </motion.div>

      {/* Ledger Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden print-area">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-card-foreground">
            {t("transaction_ledger")}{" "}
            <span className="text-muted-foreground font-normal">
              ({transactions.length})
            </span>
          </h3>
          {transactions.length > 0 && (
            <button
              onClick={() =>
                navigate(`/new-transaction?customer=${customer.id}`)
              }
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline no-print"
            >
              <PlusCircle className="w-3.5 h-3.5" /> {t("new_entry")}
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              {t("no_transactions_yet")}
            </p>
            <button
              onClick={() => navigate("/new-transaction")}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              {t("record_first_entry")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    {t("date")}
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    {t("description")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    {t("ledger_credit")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    {t("ledger_payment")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    {t("balance")}
                  </th>
                  <th className="px-3 py-2.5 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgerRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/20 transition-colors group"
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-2.5 text-card-foreground max-w-[160px] truncate">
                      {row.description ||
                        (row.type === "credit" ? "Udhar" : "Payment")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-destructive whitespace-nowrap">
                      {row.type === "credit" ? (
                        formatCurrency(row.amount)
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-success whitespace-nowrap">
                      {row.type === "payment" ? (
                        formatCurrency(row.amount)
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${row.runningBalance > 0 ? "text-destructive" : "text-success"}`}
                    >
                      {formatCurrency(Math.abs(row.runningBalance))}
                      {row.runningBalance < 0 ? " adv" : ""}
                    </td>
                    <td className="px-3 py-2.5 no-print">
                      <button
                        onClick={() => setDeleteTxnId(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Kist / Installment Plans ──────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden no-print">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display font-semibold text-sm text-card-foreground">
              Kist Plans
              {kistPlans.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1">
                  ({kistPlans.length})
                </span>
              )}
            </h3>
            {totalOverdue > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {totalOverdue} overdue
              </span>
            )}
          </div>
          <button
            onClick={() => setShowKistForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            {showKistForm ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {showKistForm ? "Cancel" : "New Kist"}
          </button>
        </div>

        {/* New Kist Form */}
        {showKistForm && (
          <motion.form
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleKistSubmit}
            className="p-4 border-b border-border bg-muted/20 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Total Amount (Rs.) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 24000"
                  value={kistForm.totalAmount}
                  onChange={(e) =>
                    setKistForm((f) => ({ ...f, totalAmount: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  No. of Installments *
                </label>
                <input
                  type="number"
                  required
                  min="2"
                  max="60"
                  placeholder="e.g. 6"
                  value={kistForm.count}
                  onChange={(e) =>
                    setKistForm((f) => ({ ...f, count: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {installmentPreview > 0 && (
              <p className="text-xs text-primary font-semibold px-1">
                → {formatCurrency(installmentPreview)} per installment
              </p>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Frequency
              </label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["weekly", "biweekly", "monthly"] as KistFrequency[]).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setKistForm((kf) => ({ ...kf, frequency: f }))
                      }
                      className={`flex-1 py-2 text-xs font-semibold transition ${
                        kistForm.frequency === f
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f === "biweekly"
                        ? "2-Weekly"
                        : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  First Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={kistForm.startDate}
                  onChange={(e) =>
                    setKistForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Description
                </label>
                <input
                  placeholder="e.g. Fridge kist"
                  value={kistForm.description}
                  onChange={(e) =>
                    setKistForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={kistSubmitting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {kistSubmitting ? "Creating..." : "Create Kist Plan"}
            </button>
          </motion.form>
        )}

        {/* Plans list */}
        {kistPlans.length === 0 && !showKistForm ? (
          <div className="px-6 py-10 text-center">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              No kist plans yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Track weekly or monthly installments for this customer
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {kistPlans.map((plan) => {
              const planInsts = kistInsts
                .filter((i) => i.kistPlanId === plan.id)
                .sort((a, b) => a.installmentNumber - b.installmentNumber);
              const isExpanded = expandedPlanId === plan.id;
              const overdueInPlan = planInsts.filter(
                (i) => !i.isPaid && new Date(i.dueDate).getTime() <= nowMs,
              ).length;
              const pct =
                plan.totalInstallments > 0
                  ? (plan.paidInstallments / plan.totalInstallments) * 100
                  : 0;
              const isCompleted = plan.status === "completed";

              return (
                <div key={plan.id} className="p-4">
                  {/* Plan summary */}
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() =>
                      setExpandedPlanId(isExpanded ? null : plan.id)
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-card-foreground">
                          {plan.description || "Kist Plan"}
                        </p>
                        {isCompleted && (
                          <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-semibold">
                            ✓ Completed
                          </span>
                        )}
                        {overdueInPlan > 0 && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold">
                            {overdueInPlan} overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(plan.totalAmount)} total •{" "}
                        {plan.paidInstallments}/{plan.totalInstallments} paid •{" "}
                        <span className="capitalize">{plan.frequency}</span>
                      </p>
                      <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isCompleted ? "bg-success" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletePlanId(plan.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Installment schedule */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 space-y-1.5"
                    >
                      {planInsts.map((inst) => {
                        const isOverdue =
                          !inst.isPaid &&
                          new Date(inst.dueDate).getTime() <= nowMs;
                        return (
                          <div
                            key={inst.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                              inst.isPaid
                                ? "bg-success/5 border border-success/20"
                                : isOverdue
                                  ? "bg-destructive/5 border border-destructive/20"
                                  : "bg-muted/30 border border-transparent"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                inst.isPaid
                                  ? "bg-success/20 text-success"
                                  : isOverdue
                                    ? "bg-destructive/20 text-destructive"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {inst.installmentNumber}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-card-foreground">
                                {formatDate(inst.dueDate)}
                              </p>
                              {inst.isPaid && inst.paidDate && (
                                <p className="text-[10px] text-success">
                                  Paid {formatDate(inst.paidDate)}
                                </p>
                              )}
                              {isOverdue && (
                                <p className="text-[10px] text-destructive font-semibold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> OVERDUE
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-mono font-semibold text-card-foreground shrink-0">
                              {formatCurrency(inst.amount)}
                            </p>
                            {inst.isPaid ? (
                              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                            ) : (
                              <button
                                onClick={() => handleMarkPaid(inst.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                                  isOverdue
                                    ? "bg-destructive text-destructive-foreground hover:opacity-90"
                                    : "bg-primary/10 text-primary hover:bg-primary/20"
                                }`}
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteTxnId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTxnId(null);
        }}
        title={t("delete")}
        description={t("delete_txn_confirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDeleteTransaction}
      />
      <ConfirmDialog
        open={deletePlanId !== null}
        onOpenChange={(o) => {
          if (!o) setDeletePlanId(null);
        }}
        title="Delete Kist Plan"
        description="This will delete the kist plan and all its installments. Payments already recorded will NOT be deleted. Continue?"
        confirmLabel="Delete Plan"
        cancelLabel={t("cancel")}
        onConfirm={confirmDeletePlan}
      />
    </div>
  );
}
