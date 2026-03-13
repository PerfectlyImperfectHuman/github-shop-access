import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, IndianRupee, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getDashboardStats, getTransactions, getCustomer } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction } from "@/types";

interface EnrichedTransaction extends Transaction {
  customerName?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ totalCustomers: 0, activeCustomers: 0, totalCredit: 0, totalPayments: 0, outstandingBalance: 0 });
  const [recent, setRecent] = useState<EnrichedTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [s, txns] = await Promise.all([getDashboardStats(), getTransactions()]);
      setStats(s);
      const enriched = await Promise.all(
        txns.slice(0, 10).map(async (t) => {
          const c = await getCustomer(t.customerId);
          return { ...t, customerName: c?.name || "Unknown" };
        })
      );
      setRecent(enriched);
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: "Total Customers", value: stats.totalCustomers.toString(), sub: `${stats.activeCustomers} active`, icon: Users, color: "text-primary" },
    { label: "Total Credit Given", value: formatCurrency(stats.totalCredit), icon: TrendingUp, color: "text-destructive" },
    { label: "Total Payments", value: formatCurrency(stats.totalPayments), icon: TrendingDown, color: "text-success" },
    { label: "Outstanding Balance", value: formatCurrency(stats.outstandingBalance), icon: IndianRupee, color: stats.outstandingBalance > 0 ? "text-warning" : "text-success" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-xl border border-border p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
                <p className="text-2xl font-display font-bold mt-1 text-card-foreground">{card.value}</p>
                {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
              </div>
              <div className={`p-2.5 rounded-lg bg-muted ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-card-foreground">Recent Transactions</h3>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <p>No transactions yet. Add your first customer and transaction to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${txn.type === "credit" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {txn.type === "credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{txn.customerName}</p>
                    <p className="text-xs text-muted-foreground">{txn.description || (txn.type === "credit" ? "Credit" : "Payment")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold font-mono ${txn.type === "credit" ? "text-destructive" : "text-success"}`}>
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
