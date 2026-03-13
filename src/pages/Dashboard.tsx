import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Package, AlertTriangle, Wallet, CalendarDays } from "lucide-react";
import { getDashboardStats, getTransactions, getCustomer } from "@/lib/db";
import { formatCurrency, formatDate, getGreeting } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { Transaction } from "@/types";

interface EnrichedTransaction extends Transaction {
  customerName?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ totalCustomers: 0, activeCustomers: 0, totalCredit: 0, totalPayments: 0, outstandingBalance: 0, todayCredit: 0, todayPayments: 0, weekCredit: 0, weekPayments: 0, lowStockProducts: 0 });
  const [recent, setRecent] = useState<EnrichedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [s, txns] = await Promise.all([getDashboardStats(), getTransactions()]);
      setStats(s);
      const enriched = await Promise.all(
        txns.slice(0, 12).map(async (t) => {
          const c = await getCustomer(t.customerId);
          return { ...t, customerName: c?.name || "Unknown" };
        })
      );
      setRecent(enriched);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const topCards = [
    { label: "Today's Credit", value: formatCurrency(stats.todayCredit), icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Today's Payments", value: formatCurrency(stats.todayPayments), icon: TrendingDown, color: "text-success", bg: "bg-success/10" },
    { label: "Outstanding", value: formatCurrency(stats.outstandingBalance), icon: Wallet, color: stats.outstandingBalance > 0 ? "text-warning" : "text-success", bg: stats.outstandingBalance > 0 ? "bg-warning/10" : "bg-success/10" },
    { label: "Total Customers", value: stats.totalCustomers.toString(), sub: `${stats.activeCustomers} active`, icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  const quickActions = [
    { label: "New Credit", icon: ArrowUpRight, action: () => navigate("/new-transaction"), color: "bg-destructive text-destructive-foreground" },
    { label: "New Payment", icon: ArrowDownRight, action: () => navigate("/new-transaction"), color: "bg-success text-success-foreground" },
    { label: "Add Customer", icon: Users, action: () => navigate("/customers"), color: "bg-primary text-primary-foreground" },
    { label: "Add Product", icon: Package, action: () => navigate("/products"), color: "bg-info text-info-foreground" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{getGreeting()}! 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your business overview</p>
        </div>
        {stats.lowStockProducts > 0 && (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm font-medium cursor-pointer"
            onClick={() => navigate("/products")}
          >
            <AlertTriangle className="w-4 h-4" />
            {stats.lowStockProducts} low stock
          </motion.div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {topCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-card rounded-xl border border-border p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs lg:text-sm text-muted-foreground font-medium">{card.label}</p>
                <p className="text-lg lg:text-2xl font-display font-bold mt-1 text-card-foreground truncate">{card.value}</p>
                {card.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>}
              </div>
              <div className={`p-2 lg:p-2.5 rounded-xl ${card.bg}`}>
                <card.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${card.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Weekly Summary Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-xl border border-border p-4 lg:p-5 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">This Week</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Credit Given</p>
            <p className="text-lg font-display font-bold text-destructive">{formatCurrency(stats.weekCredit)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payments Received</p>
            <p className="text-lg font-display font-bold text-success">{formatCurrency(stats.weekPayments)}</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35 + i * 0.05 }}
            onClick={action.action}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition hover:opacity-90 ${action.color}`}
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </motion.button>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between px-5 lg:px-6 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-card-foreground">Recent Transactions</h3>
          <button onClick={() => navigate("/transactions")} className="text-xs text-primary font-medium hover:underline">View All →</button>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No transactions yet</p>
            <p className="text-xs mt-1">Start by adding a customer and recording a transaction</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-5 lg:px-6 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/customers/${txn.customerId}`)}>
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${txn.type === "credit" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {txn.type === "credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{txn.customerName}</p>
                    <p className="text-xs text-muted-foreground">{txn.description || (txn.type === "credit" ? "Udhar" : "Payment")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold font-mono ${txn.type === "credit" ? "text-destructive" : "text-success"}`}>
                    {txn.type === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(txn.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
