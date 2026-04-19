import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Phone, ShoppingBag, DollarSign, Trash2, Plus, X, Truck } from "lucide-react";
import { db, addTransaction, deleteTransaction } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useT } from "@/contexts/LanguageContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Supplier, Transaction } from "@/types";

interface LedgerRow extends Transaction { runningBalance: number; }

export default function SupplierLedger() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bundle = useLiveQuery(async () => {
    if (!id) return { supplier: null as Supplier | null, transactions: [] as Transaction[], balance: 0 };
    const s = await db.suppliers.get(id);
    const txns = await db.transactions.where("supplierId").equals(id).toArray();
    const sortedDesc = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const opening = s?.openingBalance || 0;
    const bal = txns.reduce((b, tr) => {
      if (tr.type === "purchase") return b + tr.amount;
      if (tr.type === "supplier_payment") return b - tr.amount;
      return b;
    }, opening);
    return { supplier: s ?? null, transactions: sortedDesc, balance: bal };
  }, [id]);
  const supplier = bundle?.supplier ?? null;
  const transactions = bundle?.transactions ?? [];
  const balance = bundle?.balance ?? 0;
  const loading = !id || bundle === undefined;

  const [mode, setMode] = useState<"purchase" | "supplier_payment">("purchase");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error(t("amount_required")); return; }
    setSubmitting(true);
    try {
      await addTransaction({
        customerId: "",
        supplierId: id,
        partyType: "supplier",
        type: mode,
        amount: amt,
        description: desc.trim() || (mode === "purchase" ? t("purchase") : t("supplier_payment")),
        date: new Date(date).toISOString(),
      });
      toast.success(mode === "purchase" ? t("purchase_recorded") : t("supplier_payment_recorded"));
      setAmount(""); setDesc(""); setShowForm(false);
    } catch { toast.error("Error"); }
    finally { setSubmitting(false); }
  }

  async function confirmDeleteTransaction() {
    if (!deleteTxnId) return;
    await deleteTransaction(deleteTxnId);
    toast.success(t("txn_deleted"));
    setDeleteTxnId(null);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!supplier) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t("customer_not_found")}</p>
        <button onClick={() => navigate("/suppliers")} className="mt-4 text-primary hover:underline text-sm">← {t("back_to_suppliers")}</button>
      </div>
    );
  }

  // Running balance (oldest → newest) starting from openingBalance
  const sortedAsc = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = supplier.openingBalance || 0;
  const rowsAsc: LedgerRow[] = sortedAsc.map(t => {
    running += t.type === "purchase" ? t.amount : -t.amount;
    return { ...t, runningBalance: running };
  });
  const ledgerRows = rowsAsc.reverse();

  const totalPurchased = transactions.filter(t => t.type === "purchase").reduce((s, t) => s + t.amount, 0);
  const totalPaid = transactions.filter(t => t.type === "supplier_payment").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={() => navigate("/suppliers")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> {t("back_to_suppliers")}
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center"><Truck className="w-6 h-6 text-warning" /></div>
            <div>
              <h2 className="text-xl font-display font-bold text-card-foreground">{supplier.name}</h2>
              {supplier.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{supplier.phone}</p>}
            </div>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
            <Plus className="w-4 h-4" /> {t("new_entry")}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="p-3 rounded-lg bg-warning/10">
            <p className="text-xs text-muted-foreground">{t("total_purchased")}</p>
            <p className="text-base font-display font-bold text-warning">{formatCurrency(totalPurchased)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">{t("total_paid")}</p>
            <p className="text-base font-display font-bold text-success">{formatCurrency(totalPaid)}</p>
          </div>
          <div className={`p-3 rounded-lg ${balance > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
            <p className="text-xs text-muted-foreground">{t("to_pay")}</p>
            <p className={`text-base font-display font-bold ${balance > 0 ? "text-destructive" : "text-success"}`}>
              {balance > 0 ? formatCurrency(balance) : balance < 0 ? `${formatCurrency(Math.abs(balance))} adv` : t("settled")}
            </p>
          </div>
        </div>
      </motion.div>

      {showForm && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-card-foreground">{t("new_entry")}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button type="button" onClick={() => setMode("purchase")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition ${mode === "purchase" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
              <ShoppingBag className="w-4 h-4" /> {t("purchase")}
            </button>
            <button type="button" onClick={() => setMode("supplier_payment")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition ${mode === "supplier_payment" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
              <DollarSign className="w-4 h-4" /> {t("supplier_payment")}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t("payment_amount")} required
              className="px-4 py-2.5 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("note_optional")}
              className="sm:col-span-2 px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60">
            {t("save")}
          </button>
        </motion.form>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm text-card-foreground">
            {t("supplier_ledger")} <span className="text-muted-foreground font-normal">({transactions.length})</span>
          </h3>
        </div>
        {transactions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">{t("no_transactions_yet")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("date")}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("description")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("purchase")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("supplier_payment")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("balance")}</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgerRows.map(row => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-4 py-2.5 text-card-foreground max-w-[160px] truncate">{row.description}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-warning whitespace-nowrap">
                      {row.type === "purchase" ? formatCurrency(row.amount) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-success whitespace-nowrap">
                      {row.type === "supplier_payment" ? formatCurrency(row.amount) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${row.runningBalance > 0 ? "text-destructive" : "text-success"}`}>
                      {formatCurrency(Math.abs(row.runningBalance))}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setDeleteTxnId(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
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

      <ConfirmDialog
        open={deleteTxnId !== null}
        onOpenChange={o => { if (!o) setDeleteTxnId(null); }}
        title={t("delete")}
        description={t("delete_txn_confirm")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDeleteTransaction}
      />
    </div>
  );
}
