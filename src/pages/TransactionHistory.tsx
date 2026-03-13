import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Trash2, Calendar, Search } from "lucide-react";
import { getTransactions, getCustomers, getCustomer, deleteTransaction } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SelectField } from "@/components/ui/select-field";
import type { Transaction, Customer } from "@/types";

interface EnrichedTransaction extends Transaction { customerName: string; }

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    const [txns, custs] = await Promise.all([getTransactions(), getCustomers()]);
    setCustomers(custs);
    const enriched = await Promise.all(
      txns.map(async t => {
        const c = await getCustomer(t.customerId);
        return { ...t, customerName: c?.name || "Unknown" };
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
    if (dateTo && new Date(t.date) > new Date(dateTo + "T23:59:59")) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.customerName.toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalCredit = filtered.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayment = filtered.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);
  const hasFilters = filterCustomer || filterType || dateFrom || dateTo || search;

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    await deleteTransaction(id);
    toast.success("Transaction deleted");
    load();
  }

  function clearFilters() {
    setFilterCustomer(""); setFilterType(""); setDateFrom(""); setDateTo(""); setSearch("");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const customerOptions = [
    { value: "", label: "All Customers" },
    ...customers.map(c => ({ value: c.id, label: c.name, sublabel: c.phone || undefined })),
  ];

  const typeOptions = [
    { value: "", label: "All Types" },
    { value: "credit", label: "Credit (Udhar) only" },
    { value: "payment", label: "Payment (Wapsi) only" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Credit</p>
          <p className="text-lg font-display font-bold text-destructive">{formatCurrency(totalCredit)}</p>
          <p className="text-[11px] text-muted-foreground">{filtered.filter(t => t.type === "credit").length} entries</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Payments</p>
          <p className="text-lg font-display font-bold text-success">{formatCurrency(totalPayment)}</p>
          <p className="text-[11px] text-muted-foreground">{filtered.filter(t => t.type === "payment").length} entries</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Net Outstanding</p>
          <p className={`text-lg font-display font-bold ${totalCredit - totalPayment > 0 ? "text-warning" : "text-success"}`}>
            {formatCurrency(Math.abs(totalCredit - totalPayment))}
          </p>
          <p className="text-[11px] text-muted-foreground">{filtered.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search name or description..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="min-w-[160px] flex-1">
            <SelectField value={filterCustomer} onValueChange={setFilterCustomer} options={customerOptions} placeholder="All Customers" />
          </div>
          <div className="min-w-[140px]">
            <SelectField value={filterType} onValueChange={setFilterType} options={typeOptions} placeholder="All Types" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <span className="text-muted-foreground text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-2 text-xs text-primary font-medium hover:underline ml-auto">
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-card-foreground">
            {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            {hasFilters && <span className="text-muted-foreground font-normal"> (filtered)</span>}
          </p>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-muted-foreground">
            <p className="font-medium">{transactions.length === 0 ? "No transactions yet" : "No transactions match your filters"}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-3 text-sm text-primary hover:underline">Clear filters</button>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-4 lg:px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                <div className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onClick={() => navigate(`/customers/${txn.customerId}`)}>
                  <div className={`p-1.5 rounded-full shrink-0 ${txn.type === "credit" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {txn.type === "credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{txn.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{txn.description || (txn.type === "credit" ? "Udhar" : "Wapsi")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-mono font-semibold ${txn.type === "credit" ? "text-destructive" : "text-success"}`}>
                      {txn.type === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(txn.date)}</p>
                  </div>
                  <button onClick={() => handleDelete(txn.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
