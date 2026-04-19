import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users, TrendingUp, TrendingDown, Percent, ChevronRight } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Customer, Transaction } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const COLORS = { credit: "#e24b4a", payment: "#1d9e75", outstanding: "#ba7517", recovered: "#1d9e75" };

export default function Reports() {
  const { t } = useLanguage();
<<<<<<< HEAD
  const customersRaw = useLiveQuery(() => db.customers.toArray(), []);
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray(), []);
  const customers = customersRaw ?? [];
  const transactions = transactionsRaw ?? [];
  const topDebtors = useMemo(() => {
    const balById: Record<string, number> = {};
    for (const tr of transactions) {
      if (!tr.customerId) continue;
      if (tr.type === "credit") balById[tr.customerId] = (balById[tr.customerId] ?? 0) + tr.amount;
      else if (tr.type === "payment") balById[tr.customerId] = (balById[tr.customerId] ?? 0) - tr.amount;
    }
    return customers
      .map(c => ({ id: c.id, name: c.name, balance: balById[c.id] ?? 0 }))
      .filter(d => d.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
  }, [customers, transactions]);
  const loading = customersRaw === undefined || transactionsRaw === undefined;
=======
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topDebtors, setTopDebtors] = useState<{ name: string; balance: number; id: string }[]>([]);
  const [loading, setLoading] = useState(true);
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
  const navigate = useNavigate();

  const totalCredit = transactions.filter(txn => txn.type === "credit").reduce((s, txn) => s + txn.amount, 0);
  const totalPayments = transactions.filter(txn => txn.type === "payment").reduce((s, txn) => s + txn.amount, 0);
  const outstanding = Math.max(0, totalCredit - totalPayments);
  const recoveryRate = totalCredit > 0 ? ((totalPayments / totalCredit) * 100).toFixed(1) : "0";

  const pieData = [
    { name: t("collected"), value: totalPayments },
    { name: t("outstanding"), value: outstanding },
  ];

  // Monthly data (last 6 months)
  const monthlyData: Record<string, { credit: number; payment: number }> = {};
  transactions.forEach(t => {
    const month = new Date(t.date).toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
    if (!monthlyData[month]) monthlyData[month] = { credit: 0, payment: 0 };
    if (t.type === "credit" || t.type === "payment") monthlyData[month][t.type] += t.amount;
  });
  const barData = Object.entries(monthlyData).map(([month, d]) => ({ month, ...d })).slice(-6);

  // Daily trend (last 14 days)
  const dailyData: Record<string, { credit: number; payment: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    dailyData[key] = { credit: 0, payment: 0 };
  }
  transactions.forEach(t => {
    const key = new Date(t.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    if (dailyData[key] && (t.type === "credit" || t.type === "payment")) dailyData[key][t.type] += t.amount;
  });
  const lineData = Object.entries(dailyData).map(([day, d]) => ({ day, ...d }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("total_credit_full"), val: formatCurrency(totalCredit), icon: TrendingUp, cls: "text-destructive", bg: "bg-destructive/10" },
          { label: t("total_payments_full"), val: formatCurrency(totalPayments), icon: TrendingDown, cls: "text-success", bg: "bg-success/10" },
          { label: t("outstanding"), val: formatCurrency(outstanding), icon: BarChart3, cls: "text-warning", bg: "bg-warning/10" },
          { label: t("recovery_rate"), val: `${recoveryRate}%`, icon: Percent, cls: "text-primary", bg: "bg-primary/10" },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1.5 rounded-lg ${c.bg}`}>
                <c.icon className={`w-3.5 h-3.5 ${c.cls}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
            </div>
            <p className={`text-xl font-display font-bold ${c.cls}`}>{c.val}</p>
          </motion.div>
        ))}
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">{t("no_data_yet")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("start_adding_help")}</p>
          <button onClick={() => navigate("/new-transaction")} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
            {t("record_first_entry")}
          </button>
        </div>
      ) : (
        <>
          {/* 14-Day Trend */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-display font-semibold text-sm text-card-foreground mb-4">{t("fourteen_day_trend")}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 89%)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="credit" stroke={COLORS.credit} strokeWidth={2} name="Credit" dot={false} />
                <Line type="monotone" dataKey="payment" stroke={COLORS.payment} strokeWidth={2} name="Payment" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Monthly Bar Chart */}
            {barData.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="font-display font-semibold text-sm text-card-foreground mb-4">{t("monthly_overview")}</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 89%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="credit" fill={COLORS.credit} name="Credit" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="payment" fill={COLORS.payment} name="Payment" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pie Chart */}
            {totalCredit > 0 && (
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="font-display font-semibold text-sm text-card-foreground mb-4">{t("collection_status")}</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}>
                      <Cell fill={COLORS.payment} />
                      <Cell fill={COLORS.credit} />
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#1d9e75]" /><span className="text-xs text-muted-foreground">{t("collected")}</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#e24b4a]" /><span className="text-xs text-muted-foreground">{t("outstanding")}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Top Debtors */}
          {topDebtors.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-semibold text-sm text-card-foreground">{t("top_outstanding")}</h3>
              </div>
              <div className="divide-y divide-border">
                {topDebtors.map((d, i) => {
                  const pct = totalCredit > 0 ? (d.balance / outstanding * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/customers/${d.id}`)}>
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{d.name}</p>
                        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-destructive/60 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-sm font-mono font-semibold text-destructive">{formatCurrency(d.balance)}</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
