import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Filter, Trash2, Calendar } from "lucide-react";
import { getTransactions, getCustomers, getCustomer, deleteTransaction } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Transaction, Customer } from "@/types";

interface EnrichedTransaction extends Transaction {
  customerName: string;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterType, setFilterType] = useState<"" | "credit" | "payment">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    return true;
  });

  const totalCredit = filtered.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayment = filtered.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    await deleteTransaction(id);
    toast.success("Transaction deleted");
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Credit</p>
          <p className="text-lg font-display font-bold text-destructive">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Payments</p>
          <p className="text-lg font-display font-bold text-success">{formatCurrency(totalPayment)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={`text-lg font-display font-bold ${totalCredit - totalPayment > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(totalCredit - totalPayment)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
        <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as "" | "credit" | "payment")} className="px-3 py-2 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All Types</option>
          <option value="credit">Credit Only</option>
          <option value="payment">Payments Only</option>
        </select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <span className="text-muted-foreground text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Transaction List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No transactions found.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-4 lg:px-5 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => navigate(`/customers/${txn.customerId}`)}>
                  <div className={`p-1.5 rounded-full ${txn.type === "credit" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {txn.type === "credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{txn.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{txn.description || (txn.type === "credit" ? "Udhar" : "Payment")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-sm font-mono font-semibold ${txn.type === "credit" ? "text-destructive" : "text-success"}`}>
                      {txn.type === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(txn.date)}</p>
                  </div>
                  <button onClick={() => handleDelete(txn.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
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
