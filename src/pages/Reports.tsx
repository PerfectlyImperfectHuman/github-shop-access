import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { getCustomers, getTransactions, getCustomerBalance } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import type { Customer, Transaction } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const CHART_COLORS = ["hsl(160, 84%, 39%)", "hsl(0, 72%, 51%)", "hsl(38, 92%, 50%)", "hsl(210, 92%, 55%)"];

export default function Reports() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topDebtors, setTopDebtors] = useState<{ name: string; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [custs, txns] = await Promise.all([getCustomers(), getTransactions()]);
      setCustomers(custs);
      setTransactions(txns);

      const debtors = await Promise.all(
        custs.map(async c => ({ name: c.name, balance: await getCustomerBalance(c.id) }))
      );
      setTopDebtors(debtors.filter(d => d.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 10));
      setLoading(false);
    }
    load();
  }, []);

  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);
  const recoveryRate = totalCredit > 0 ? ((totalPayments / totalCredit) * 100).toFixed(1) : "N/A";

  const pieData = [
    { name: "Recovered", value: totalPayments },
    { name: "Outstanding", value: Math.max(0, totalCredit - totalPayments) },
  ];

  // Monthly breakdown
  const monthlyData: Record<string, { credit: number; payment: number }> = {};
  transactions.forEach(t => {
    const month = new Date(t.date).toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
    if (!monthlyData[month]) monthlyData[month] = { credit: 0, payment: 0 };
    monthlyData[month][t.type] += t.amount;
  });
  const barData = Object.entries(monthlyData).map(([month, d]) => ({ month, ...d })).slice(-6);

  // Daily trend (last 14 days)
  const dailyData: Record<string, { credit: number; payment: number }> = {};
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    dailyData[key] = { credit: 0, payment: 0 };
  }
  transactions.forEach(t => {
    const key = new Date(t.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    if (dailyData[key]) dailyData[key][t.type] += t.amount;
  });
  const lineData = Object.entries(dailyData).map(([day, d]) => ({ day, ...d }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Credit", val: formatCurrency(totalCredit), icon: TrendingUp, cls: "text-destructive" },
          { label: "Total Payments", val: formatCurrency(totalPayments), icon: TrendingDown, cls: "text-success" },
          { label: "Outstanding", val: formatCurrency(Math.max(0, totalCredit - totalPayments)), icon: BarChart3, cls: "text-warning" },
          { label: "Recovery Rate", val: typeof recoveryRate === "string" ? `${recoveryRate}%` : "N/A", icon: Percent, cls: "text-primary" },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <c.icon className={`w-4 h-4 ${c.cls}`} />
              <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
            </div>
            <p className={`text-xl font-display font-bold mt-1 ${c.cls}`}>{c.val}</p>
          </motion.div>
        ))}
      </div>

      {/* 14-Day Trend */}
      {lineData.length > 0 && transactions.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-display font-semibold mb-4 text-card-foreground text-sm">14-Day Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 89%)" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="credit" stroke="hsl(0, 72%, 51%)" strokeWidth={2} name="Credit" dot={false} />
              <Line type="monotone" dataKey="payment" stroke="hsl(142, 71%, 40%)" strokeWidth={2} name="Payment" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly Bar Chart */}
        {barData.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-display font-semibold mb-4 text-card-foreground text-sm">Monthly Overview</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 89%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                <Bar dataKey="credit" fill="hsl(0, 72%, 51%)" name="Credit" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payment" fill="hsl(142, 71%, 40%)" name="Payments" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart */}
        {totalCredit > 0 && (
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-display font-semibold mb-4 text-card-foreground text-sm">Collection Status</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Debtors */}
      {topDebtors.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display font-semibold text-sm text-card-foreground">Top Outstanding Balances</h3>
          </div>
          <div className="divide-y divide-border">
            {topDebtors.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                  <p className="text-sm font-medium text-card-foreground">{d.name}</p>
                </div>
                <p className="text-sm font-mono font-semibold text-destructive">{formatCurrency(d.balance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No data yet</p>
          <p className="text-xs mt-1">Add customers and transactions to see reports</p>
        </div>
      )}
    </div>
  );
}
