import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Package, AlertTriangle, Wallet, CalendarDays } from "lucide-react";
import { getDashboardStats, getTransactions, getCustomer, initSettings } from "@/lib/db";
import { formatCurrency, formatDate, getGreeting } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { Transaction } from "@/types";

interface EnrichedTransaction extends Transaction { customerName?: string; }

export default function Dashboard() {
  const [stats, setStats] = useState({ totalCustomers: 0, activeCustomers: 0, totalCredit: 0, totalPayments: 0, outstandingBalance: 0, todayCredit: 0, todayPayments: 0, weekCredit: 0, weekPayments: 0, lowStockProducts: 0 });
  const [recent, setRecent] = useState<EnrichedTransaction[]>([]);
  const [shopName, setShopName] = useState("My Shop");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [s, txns, settings] = await Promise.all([getDashboardStats(), getTransactions(), initSettings()]);
      setStats(s);
      setShopName(settings.shopName);
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const topCards = [
    { label: "Today's Credit", value: formatCurrency(stats.todayCredit), icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Today's Payments", value: formatCurrency(stats.todayPayments), icon: TrendingDown, color: "text-success", bg: "bg-success/10" },
    { label: "Outstanding", value: formatCurrency(stats.outstandingBalance), icon: Wallet, color: stats.outstandingBalance > 0 ? "text-warning" : "text-success", bg: stats.outstandingBalance > 0 ? "bg-warning/10" : "bg-success/10" },
    { label: "Customers", value: stats.totalCustomers.toString(), sub: `${stats.activeCustomers} active`, icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  const quickActions = [
    { label: "Give Credit", sublabel: "Udhar", icon: ArrowUpRight, action: () => navigate("/new-transaction?type=credit"), color: "bg-destructive text-destructive-foreground" },
    // FIX: Navigate to payment type correctly
    { label: "Take Payment", sublabel: "Wapsi", icon: ArrowDownRight, action: () => navigate("/new-transaction?type=payment"), color: "bg-success text-success-foreground" },
    { label: "Add Customer", sublabel: "New", icon: Users, action: () => navigate("/customers"), color: "bg-primary text-primary-foreground" },
    { label: "Add Product", sublabel: "Inventory", icon: Package, action: () => navigate("/products"), color: "bg-info text-info-foreground" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-display font-bold text-foreground">{getGreeting()}! 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{shopName} — Overview</p>
        </div>
        {stats.lowStockProducts > 0 && (
          <motion.button
            initial={{ scale: 0.9 }} animate={{ scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-semibold border border-warning/20"
            onClick={() => navigate("/products")}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {stats.lowStockProducts} low stock
          </motion.button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {topCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-card rounded-xl border border-border p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium leading-tight">{card.label}</p>
                <p className="text-lg lg:text-xl font-display font-bold mt-1 text-card-foreground truncate">{card.value}</p>
                {card.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>}
              </div>
              <div className={`p-2 rounded-xl ${card.bg} shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Weekly Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
        className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">This Week</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Credit Given</p>
            <p className="text-xl font-display font-bold text-destructive">{formatCurrency(stats.weekCredit)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payments Received</p>
            <p className="text-xl font-display font-bold text-success">{formatCurrency(stats.weekPayments)}</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.33 + i * 0.04 }}
            onClick={action.action}
            className={`flex flex-col items-center justify-center gap-0.5 py-3.5 rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-95 ${action.color}`}
          >
            <action.icon className="w-5 h-5 mb-0.5" />
            <span>{action.label}</span>
            <span className="text-[10px] opacity-70 font-normal">{action.sublabel}</span>
          </motion.button>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-card-foreground text-sm">Recent Transactions</h3>
          <button onClick={() => navigate("/transactions")} className="text-xs text-primary font-medium hover:underline">View All →</button>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add a customer and record your first entry</p>
            <button onClick={() => navigate("/new-transaction")} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              Record First Entry
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/customers/${txn.customerId}`)}>
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${txn.type === "credit" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {txn.type === "credit" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{txn.customerName}</p>
                    <p className="text-xs text-muted-foreground">{txn.description || (txn.type === "credit" ? "Udhar" : "Wapsi")}</p>
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
