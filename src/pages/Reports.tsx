import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users, TrendingUp, TrendingDown } from "lucide-react";
import { getCustomers, getTransactions, getCustomerBalance } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import type { Customer, Transaction } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = ["hsl(220, 70%, 50%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"];

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

      // Top debtors
      const debtors = await Promise.all(
        custs.map(async c => ({ name: c.name, balance: await getCustomerBalance(c.id) }))
      );
      setTopDebtors(debtors.filter(d => d.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 8));
      setLoading(false);
    }
    load();
  }, []);

  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

  const pieData = [
    { name: "Payments", value: totalPayments },
    { name: "Outstanding", value: Math.max(0, totalCredit - totalPayments) },
  ];

  // Monthly breakdown
  const monthlyData: Record<string, { credit: number; payment: number }> = {};
  transactions.forEach(t => {
    const month = new Date(t.date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (!monthlyData[month]) monthlyData[month] = { credit: 0, payment: 0 };
    monthlyData[month][t.type] += t.amount;
  });
  const barData = Object.entries(monthlyData).map(([month, d]) => ({ month, ...d })).slice(-6);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Credit Given", val: formatCurrency(totalCredit), icon: TrendingUp, cls: "text-destructive" },
          { label: "Total Payments", val: formatCurrency(totalPayments), icon: TrendingDown, cls: "text-success" },
          { label: "Recovery Rate", val: totalCredit > 0 ? `${((totalPayments / totalCredit) * 100).toFixed(1)}%` : "N/A", icon: BarChart3, cls: "text-primary" },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <p className="text-sm text-muted-foreground font-medium">{c.label}</p>
            <p className={`text-2xl font-display font-bold mt-1 ${c.cls}`}>{c.val}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Bar Chart */}
        {barData.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-display font-semibold mb-4 text-card-foreground">Monthly Overview</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 15%, 89%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="credit" fill="hsl(0, 72%, 51%)" name="Credit" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payment" fill="hsl(142, 71%, 45%)" name="Payments" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart */}
        {totalCredit > 0 && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-display font-semibold mb-4 text-card-foreground">Collection Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display font-semibold text-card-foreground">Top Outstanding Balances</h3>
          </div>
          <div className="divide-y divide-border">
            {topDebtors.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>
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
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No data yet. Add customers and transactions to see reports.</p>
        </div>
      )}
    </div>
  );
}
