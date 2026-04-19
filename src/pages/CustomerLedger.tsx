import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpRight, ArrowDownRight, ArrowLeft, Phone, MapPin, Printer, User, Wallet, MessageCircle, PlusCircle, Trash2 } from "lucide-react";
import { db, deleteTransaction } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Customer, Transaction } from "@/types";

interface LedgerRow extends Transaction { runningBalance: number; }

export default function CustomerLedger() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ledger = useLiveQuery(async () => {
    if (!id) return { customer: null as Customer | null, transactions: [] as Transaction[], balance: 0 };
    const [c, txns] = await Promise.all([
      db.customers.get(id),
      db.transactions.where("customerId").equals(id).toArray(),
    ]);
    const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const bal = sorted.reduce((b, tr) => {
      if (tr.type === "credit") return b + tr.amount;
      if (tr.type === "payment") return b - tr.amount;
      return b;
    }, 0);
    return { customer: c ?? null, transactions: sorted, balance: bal };
  }, [id]);
  const customer = ledger?.customer ?? null;
  const transactions = ledger?.transactions ?? [];
  const balance = ledger?.balance ?? 0;
  const loading = !id || ledger === undefined;
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);

  async function confirmDeleteTransaction() {
    if (!deleteTxnId) return;
    await deleteTransaction(deleteTxnId);
    toast.success(t("txn_deleted"));
    setDeleteTxnId(null);
  }

  function handlePrint() { window.print(); }

  function handleWhatsApp() {
    if (!customer?.phone) { toast.error(t("no_phone_saved")); return; }
    const digits = customer.phone.replace(/\D/g, "");
    const intl = digits.startsWith("0") ? "92" + digits.slice(1) : digits.startsWith("92") ? digits : "92" + digits;
    const balMsg = balance > 0
      ? `Aapka balance Rs. ${balance.toLocaleString()} baaki hai.`
      : balance < 0
        ? `Aapka advance Rs. ${Math.abs(balance).toLocaleString()} hai.`
        : "Aapka account bilkul theek hai (settled).";
    const msg = `Assalam u Alaikum ${customer.name}!\n\n${balMsg}\n\nShukriya apni dukaan par trust karne ka! 🙏`;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t("customer_not_found")}</p>
        <button onClick={() => navigate("/customers")} className="mt-4 text-primary hover:underline text-sm">← {t("back_to_customers")}</button>
      </div>
    );
  }

  // Running balance
  const reversedTxns = [...transactions].reverse();
  let running = 0;
  const ledgerRows: LedgerRow[] = reversedTxns.map(txn => {
    running += txn.type === "credit" ? txn.amount : -txn.amount;
    return { ...txn, runningBalance: running };
  }).reverse();

  const totalCredit = transactions.filter(txn => txn.type === "credit").reduce((s, txn) => s + txn.amount, 0);
  const totalPayments = transactions.filter(txn => txn.type === "payment").reduce((s, txn) => s + txn.amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate("/customers")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition no-print">
        <ArrowLeft className="w-4 h-4" /> {t("back_to_customers")}
      </button>

      {/* Customer Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-5 shadow-sm print-area">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-card-foreground">{customer.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>}
                {customer.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.address}</span>}
                {customer.cnic && <span>CNIC: {customer.cnic}</span>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 no-print flex-wrap">
            {customer.phone && (
              <button onClick={handleWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-600 text-sm font-medium hover:bg-green-500/20 transition">
                <MessageCircle className="w-4 h-4" /> {t("whatsapp")}
              </button>
            )}
            <button
              onClick={() => navigate(`/new-transaction?type=payment&customer=${customer.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition">
              <PlusCircle className="w-4 h-4" /> {t("record_payment")}
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:opacity-90 transition">
              <Printer className="w-4 h-4" /> {t("print")}
            </button>
          </div>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="p-3 rounded-lg bg-destructive/10">
            <p className="text-xs text-muted-foreground">{t("total_credit_label")}</p>
            <p className="text-base font-display font-bold text-destructive">{formatCurrency(totalCredit)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">{t("total_paid")}</p>
            <p className="text-base font-display font-bold text-success">{formatCurrency(totalPayments)}</p>
          </div>
          <div className={`p-3 rounded-lg ${balance > 0 ? "bg-warning/10" : "bg-success/10"}`}>
            <p className="text-xs text-muted-foreground">{t("balance")}</p>
            <p className={`text-base font-display font-bold ${balance > 0 ? "text-warning" : "text-success"}`}>
              {balance > 0 ? formatCurrency(balance) : balance < 0 ? `${formatCurrency(Math.abs(balance))} ${t("advance")}` : `${t("settled")} ✓`}
            </p>
          </div>
        </div>

        {customer.creditLimit > 0 && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-muted flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              {t("credit_limit")}: <span className="font-semibold text-foreground">{formatCurrency(customer.creditLimit)}</span>
              {balance > customer.creditLimit
                ? <span className="text-destructive font-semibold ml-2">⚠ {t("exceeded_by")} {formatCurrency(balance - customer.creditLimit)}</span>
                : <span className="text-success font-semibold ml-2">{t("available")}: {formatCurrency(customer.creditLimit - Math.max(0, balance))}</span>
              }
            </p>
          </div>
        )}
      </motion.div>

      {/* Ledger Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden print-area">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-card-foreground">
            {t("transaction_ledger")} <span className="text-muted-foreground font-normal">({transactions.length})</span>
          </h3>
          {transactions.length > 0 && (
            <button onClick={() => navigate(`/new-transaction?customer=${customer.id}`)}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline no-print">
              <PlusCircle className="w-3.5 h-3.5" /> {t("new_entry")}
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">{t("no_transactions_yet")}</p>
            <button onClick={() => navigate(`/new-transaction`)} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              {t("record_first_entry")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("date")}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("description")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("ledger_credit")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("ledger_payment")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("balance")}</th>
                  <th className="px-3 py-2.5 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgerRows.map(row => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-4 py-2.5 text-card-foreground max-w-[160px] truncate">{row.description || (row.type === "credit" ? "Udhar" : "Payment")}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-destructive whitespace-nowrap">
                      {row.type === "credit" ? formatCurrency(row.amount) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-success whitespace-nowrap">
                      {row.type === "payment" ? formatCurrency(row.amount) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${row.runningBalance > 0 ? "text-destructive" : "text-success"}`}>
                      {formatCurrency(Math.abs(row.runningBalance))}{row.runningBalance < 0 ? " adv" : ""}
                    </td>
                    <td className="px-3 py-2.5 no-print">
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
