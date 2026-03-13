import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Filter } from "lucide-react";
import { getTransactions, getCustomers, getCustomer } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction, Customer } from "@/types";

interface EnrichedTransaction extends Transaction {
  customerName: string;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterType, setFilterType] = useState<"" | "credit" | "payment">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    load();
  }, []);

  const filtered = transactions.filter(t => {
    if (filterCustomer && t.customerId !== filterCustomer) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
        <select
          value={filterCustomer}
          onChange={e => setFilterCustomer(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as "" | "credit" | "payment")}
          className="px-4 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Types</option>
          <option value="credit">Credit Only</option>
          <option value="payment">Payments Only</option>
        </select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Transaction List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No transactions found.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${txn.type === "credit" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {txn.type === "credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{txn.customerName}</p>
                    <p className="text-xs text-muted-foreground">{txn.description || (txn.type === "credit" ? "Credit given" : "Payment received")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-semibold ${txn.type === "credit" ? "text-destructive" : "text-success"}`}>
                    {txn.type === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(txn.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
