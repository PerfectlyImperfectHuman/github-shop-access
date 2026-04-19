import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Trash2, Calendar, Search, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteTransaction } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SelectField } from "@/components/ui/select-field";
<<<<<<< HEAD
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
=======
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
import { useLanguage } from "@/contexts/LanguageContext";
import type { Transaction, Customer } from "@/types";

interface EnrichedTransaction extends Transaction { customerName: string; }

export default function TransactionHistory() {
  const { t } = useLanguage();
<<<<<<< HEAD
  const txnsRaw = useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []);
  const customersRaw = useLiveQuery(() => db.customers.toArray(), []);
  const transactions = useMemo((): EnrichedTransaction[] => {
    const custs = customersRaw ?? [];
    const nameById = new Map(custs.map(c => [c.id, c.name]));
    const txns = txnsRaw ?? [];
    return txns.map(txn => ({
      ...txn,
      customerName: nameById.get(txn.customerId) || (txn.type === "sale" ? "Cash Sale" : "—"),
    }));
  }, [txnsRaw, customersRaw]);
  const customers = customersRaw ?? [];
=======
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [customers, setCustomers]       = useState<Customer[]>([]);
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterType, setFilterType]         = useState("");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");
  const [search, setSearch]                 = useState("");
  const loading = txnsRaw === undefined || customersRaw === undefined;
  const [deleteTxnId, setDeleteTxnId]       = useState<string | null>(null);
  const navigate = useNavigate();

<<<<<<< HEAD
  const filtered = transactions.filter(txn => {
    if (filterCustomer && txn.customerId !== filterCustomer) return false;
    if (filterType && txn.type !== filterType) return false;
    if (dateFrom && new Date(txn.date) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(txn.date) > new Date(dateTo + "T23:59:59")) return false;
=======
  async function load() {
    const [txns, custs] = await Promise.all([getTransactions(), getCustomers()]);
    setCustomers(custs);
    const enriched = await Promise.all(
      txns.map(async t => {
        const c = await getCustomer(t.customerId);
        return { ...t, customerName: c?.name || (t.type === "sale" ? "Cash Sale" : "—") };
      })
    );
    setTransactions(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = transactions.filter(t => {
    if (filterCustomer && t.customerId !== filterCustomer) return false;
    if (filterType && t.type !== filterType) return false;
    if (dateFrom && new Date(t.date) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(t.date) > new Date(dateTo + "T23:59:59")) return false;
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
    if (search) {
      const q = search.toLowerCase();
      if (!txn.customerName.toLowerCase().includes(q) && !(txn.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalCredit  = filtered.filter(txn => txn.type === "credit").reduce((s, txn) => s + txn.amount, 0);
  const totalPayment = filtered.filter(txn => txn.type === "payment").reduce((s, txn) => s + txn.amount, 0);
  const totalSales   = filtered.filter(txn => txn.type === "sale").reduce((s, txn) => s + txn.amount, 0);
  const hasFilters   = filterCustomer || filterType || dateFrom || dateTo || search;

<<<<<<< HEAD
  async function confirmDeleteTransaction() {
    if (!deleteTxnId) return;
    await deleteTransaction(deleteTxnId);
    toast.success(t("txn_deleted"));
    setDeleteTxnId(null);
=======
  async function handleDelete(id: string) {
    if (!confirm(t("delete_txn_confirm"))) return;
    await deleteTransaction(id);
    toast.success(t("txn_deleted"));
    load();
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
  }

  function clearFilters() {
    setFilterCustomer(""); setFilterType(""); setDateFrom(""); setDateTo(""); setSearch("");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const customerOptions = [
    { value: "", label: t("all_customers") },
    ...customers.map(c => ({ value: c.id, label: c.name, sublabel: c.phone || undefined })),
  ];
  const typeOptions = [
    { value: "", label: t("all_types") },
    { value: "credit", label: t("udhar_credit") },
    { value: "payment", label: t("payment_wapsi") },
    { value: "sale", label: t("cash_sale") },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
<<<<<<< HEAD
          { label: t("udhar_credit"),    val: totalCredit,  sub: `${filtered.filter(txn => txn.type === "credit").length}`,  cls: "text-destructive" },
          { label: t("payment_wapsi"),   val: totalPayment, sub: `${filtered.filter(txn => txn.type === "payment").length}`, cls: "text-success" },
          { label: t("cash_sale"),       val: totalSales,   sub: `${filtered.filter(txn => txn.type === "sale").length}`,    cls: "text-primary" },
=======
          { label: t("udhar_credit"),    val: totalCredit,  sub: `${filtered.filter(t => t.type === "credit").length}`,  cls: "text-destructive" },
          { label: t("payment_wapsi"),   val: totalPayment, sub: `${filtered.filter(t => t.type === "payment").length}`, cls: "text-success" },
          { label: t("cash_sale"),       val: totalSales,   sub: `${filtered.filter(t => t.type === "sale").length}`,    cls: "text-primary" },
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-base font-display font-bold ${s.cls} leading-tight`}>{formatCurrency(s.val)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-3 shadow-sm space-y-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder={t("search_history_placeholder")}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Customer + Type — side by side on mobile */}
        <div className="grid grid-cols-2 gap-2">
          <SelectField value={filterCustomer} onValueChange={setFilterCustomer} options={customerOptions} placeholder="All Customers" />
          <SelectField value={filterType}     onValueChange={setFilterType}     options={typeOptions}     placeholder="All Types" />
        </div>

        {/* Date range — two clean rows */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground w-7 shrink-0">{t("from")}</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {dateFrom && (
              <button onClick={() => setDateFrom("")} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 shrink-0" />
            <span className="text-xs text-muted-foreground w-7 shrink-0">{t("to")}</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {dateTo && (
              <button onClick={() => setDateTo("")} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="w-full text-xs text-primary font-medium hover:underline py-1">
            {t("clear_filters")}
          </button>
        )}
      </div>

      {/* Transaction List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-card-foreground">
            {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            {hasFilters && <span className="text-muted-foreground font-normal"> (filtered)</span>}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <p className="font-medium">{transactions.length === 0 ? t("no_transactions_yet") : t("no_customers_match")}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-3 text-sm text-primary hover:underline">{t("clear_filters")}</button>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(txn => (
              <div key={txn.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                <div className={`p-1.5 rounded-full shrink-0 ${
                  txn.type === "credit"  ? "bg-destructive/10 text-destructive"
                  : txn.type === "payment" ? "bg-success/10 text-success"
                  : "bg-primary/10 text-primary"
                }`}>
                  {txn.type === "credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => txn.customerId && navigate(`/customers/${txn.customerId}`)}>
                  <p className="text-sm font-medium text-card-foreground truncate">{txn.customerName}</p>
                  <p className="text-xs text-muted-foreground truncate">{txn.description || (txn.type === "credit" ? t("udhar_credit") : txn.type === "payment" ? t("payment_wapsi") : t("cash_sale"))}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-mono font-semibold ${
                      txn.type === "credit"  ? "text-destructive"
                      : txn.type === "payment" ? "text-success"
                      : "text-primary"
                    }`}>
                      {txn.type === "credit" ? "+" : "−"}{formatCurrency(txn.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(txn.date)}</p>
                  </div>
                  <button onClick={() => setDeleteTxnId(txn.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
