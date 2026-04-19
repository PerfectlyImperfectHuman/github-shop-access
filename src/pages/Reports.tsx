import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  Percent,
  ChevronRight,
  DollarSign,
  Package,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Customer, Transaction } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const COLORS = {
  credit: "#e24b4a",
  payment: "#1d9e75",
  outstanding: "#ba7517",
  profit: "#2563eb",
  expense: "#f59e0b",
};

type Tab = "khata" | "pl";
type Period = "month" | "lastmonth" | "year" | "all";

function getPeriodRange(p: Period): { start: Date; end: Date } | null {
  const now = new Date();
  if (p === "month")
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  if (p === "lastmonth")
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  if (p === "year")
    return { start: new Date(now.getFullYear(), 0, 1), end: now };
  return null;
}

export default function Reports() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>("khata");
  const [period, setPeriod] = useState<Period>("month");

  // ── Data ─────────────────────────────────────────────────────────────────
  const customersRaw = useLiveQuery(() => db.customers.toArray(), []);
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray(), []);
  const productsRaw = useLiveQuery(() => db.products.toArray(), []);
  const expensesRaw = useLiveQuery(() => db.expenses.toArray(), []);

  const customers = customersRaw ?? [];
  const transactions = transactionsRaw ?? [];
  const products = productsRaw ?? [];
  const expenses = expensesRaw ?? [];

  const loading =
    customersRaw === undefined ||
    transactionsRaw === undefined ||
    productsRaw === undefined ||
    expensesRaw === undefined;

  // ── Khata tab calculations ────────────────────────────────────────────────
  const topDebtors = useMemo(() => {
    const balById: Record<string, number> = {};
    for (const tr of transactions) {
      if (!tr.customerId) continue;
      if (tr.type === "credit")
        balById[tr.customerId] = (balById[tr.customerId] ?? 0) + tr.amount;
      if (tr.type === "payment")
        balById[tr.customerId] = (balById[tr.customerId] ?? 0) - tr.amount;
    }
    return customers
      .map((c) => ({ id: c.id, name: c.name, balance: balById[c.id] ?? 0 }))
      .filter((d) => d.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
  }, [customers, transactions]);

  const totalCredit = transactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions
    .filter((t) => t.type === "payment")
    .reduce((s, t) => s + t.amount, 0);
  const outstanding = Math.max(0, totalCredit - totalPayments);
  const recoveryRate =
    totalCredit > 0 ? ((totalPayments / totalCredit) * 100).toFixed(1) : "0";

  const pieData = [
    { name: t("collected"), value: totalPayments },
    { name: t("outstanding"), value: outstanding },
  ];

  const monthlyData: Record<string, { credit: number; payment: number }> = {};
  transactions.forEach((txn) => {
    const month = new Date(txn.date).toLocaleDateString("en-PK", {
      month: "short",
      year: "2-digit",
    });
    if (!monthlyData[month]) monthlyData[month] = { credit: 0, payment: 0 };
    if (txn.type === "credit" || txn.type === "payment")
      monthlyData[month][txn.type] += txn.amount;
  });
  const barData = Object.entries(monthlyData)
    .map(([month, d]) => ({ month, ...d }))
    .slice(-6);

  const dailyData: Record<string, { credit: number; payment: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
    });
    dailyData[key] = { credit: 0, payment: 0 };
  }
  transactions.forEach((txn) => {
    const key = new Date(txn.date).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
    });
    if (dailyData[key] && (txn.type === "credit" || txn.type === "payment"))
      dailyData[key][txn.type] += txn.amount;
  });
  const lineData = Object.entries(dailyData).map(([day, d]) => ({ day, ...d }));

  // ── P&L tab calculations ──────────────────────────────────────────────────
  const plRange = getPeriodRange(period);

  const plTxns = transactions.filter((txn) => {
    if (!plRange) return true;
    const d = new Date(txn.date);
    return d >= plRange.start && d <= plRange.end;
  });
  const plExps = expenses.filter((e) => {
    if (!plRange) return true;
    const d = new Date(e.date);
    return d >= plRange.start && d <= plRange.end;
  });

  const productsMap = new Map(products.map((p) => [p.id, p]));

  // Revenue = cash sales + credit sales
  const revenue = plTxns
    .filter((t) => t.type === "sale" || t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);

  // COGS = only where product + quantity is known
  const cogs = plTxns
    .filter(
      (t) =>
        (t.type === "sale" || t.type === "credit") && t.productId && t.quantity,
    )
    .reduce((s, t) => {
      const p = productsMap.get(t.productId!);
      return s + (p ? p.costPrice * (t.quantity ?? 0) : 0);
    }, 0);

  const hasCogsData = cogs > 0;
  const grossProfit = revenue - cogs;
  const totalExpenses = plExps.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const profitMargin =
    revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0";
  const isProfit = netProfit >= 0;

  // Expense breakdown by category
  const expByCategory: Record<string, number> = {};
  plExps.forEach((e) => {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
  });
  const expBreakdown = Object.entries(expByCategory).sort(
    (a, b) => b[1] - a[1],
  );

  // Monthly P&L (last 6 months)
  const monthlyPL: Record<
    string,
    { revenue: number; expenses: number; profit: number }
  > = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString("en-PK", {
      month: "short",
      year: "2-digit",
    });
    monthlyPL[key] = { revenue: 0, expenses: 0, profit: 0 };
  }
  transactions.forEach((txn) => {
    if (txn.type !== "sale" && txn.type !== "credit") return;
    const key = new Date(txn.date).toLocaleDateString("en-PK", {
      month: "short",
      year: "2-digit",
    });
    if (monthlyPL[key]) monthlyPL[key].revenue += txn.amount;
  });
  expenses.forEach((e) => {
    const key = new Date(e.date).toLocaleDateString("en-PK", {
      month: "short",
      year: "2-digit",
    });
    if (monthlyPL[key]) monthlyPL[key].expenses += e.amount;
  });
  Object.values(monthlyPL).forEach((m) => {
    m.profit = m.revenue - m.expenses;
  });
  const plBarData = Object.entries(monthlyPL).map(([month, d]) => ({
    month,
    ...d,
  }));

  const periodLabels: Record<Period, string> = {
    month: "This Month",
    lastmonth: "Last Month",
    year: "This Year",
    all: "All Time",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Tab Switcher ───────────────────────────────────────────────── */}
      <div className="flex rounded-xl border border-border overflow-hidden bg-muted/30 p-1 gap-1">
        {(
          [
            ["khata", "📒 Khata Report"],
            ["pl", "💰 Profit & Loss"],
          ] as [Tab, string][]
        ).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  KHATA TAB                                                      */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === "khata" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: t("total_credit_full"),
                val: formatCurrency(totalCredit),
                icon: TrendingUp,
                cls: "text-destructive",
                bg: "bg-destructive/10",
              },
              {
                label: t("total_payments_full"),
                val: formatCurrency(totalPayments),
                icon: TrendingDown,
                cls: "text-success",
                bg: "bg-success/10",
              },
              {
                label: t("outstanding"),
                val: formatCurrency(outstanding),
                icon: BarChart3,
                cls: "text-warning",
                bg: "bg-warning/10",
              },
              {
                label: t("recovery_rate"),
                val: `${recoveryRate}%`,
                icon: Percent,
                cls: "text-primary",
                bg: "bg-primary/10",
              },
            ].map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card rounded-xl border border-border p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${c.bg}`}>
                    <c.icon className={`w-3.5 h-3.5 ${c.cls}`} />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {c.label}
                  </p>
                </div>
                <p className={`text-xl font-display font-bold ${c.cls}`}>
                  {c.val}
                </p>
              </motion.div>
            ))}
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">
                {t("no_data_yet")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("start_adding_help")}
              </p>
              <button
                onClick={() => navigate("/new-transaction")}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                {t("record_first_entry")}
              </button>
            </div>
          ) : (
            <>
              {/* 14-Day Trend */}
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h3 className="font-display font-semibold text-sm text-card-foreground mb-4">
                  {t("fourteen_day_trend")}
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={lineData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(220, 13%, 89%)"
                    />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: unknown) => formatCurrency(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="credit"
                      stroke={COLORS.credit}
                      strokeWidth={2}
                      name="Credit"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="payment"
                      stroke={COLORS.payment}
                      strokeWidth={2}
                      name="Payment"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {barData.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <h3 className="font-display font-semibold text-sm text-card-foreground mb-4">
                      {t("monthly_overview")}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData} barGap={4}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(220, 13%, 89%)"
                        />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: unknown) => formatCurrency(Number(v))}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          dataKey="credit"
                          fill={COLORS.credit}
                          name="Credit"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="payment"
                          fill={COLORS.payment}
                          name="Payment"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {totalCredit > 0 && (
                  <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <h3 className="font-display font-semibold text-sm text-card-foreground mb-4">
                      {t("collection_status")}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${((percent || 0) * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          <Cell fill={COLORS.payment} />
                          <Cell fill={COLORS.credit} />
                        </Pie>
                        <Tooltip
                          formatter={(v: unknown) => formatCurrency(Number(v))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#1d9e75]" />
                        <span className="text-xs text-muted-foreground">
                          {t("collected")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#e24b4a]" />
                        <span className="text-xs text-muted-foreground">
                          {t("outstanding")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {topDebtors.length > 0 && (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-display font-semibold text-sm text-card-foreground">
                      {t("top_outstanding")}
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {topDebtors.map((d, i) => {
                      const pct =
                        outstanding > 0 ? (d.balance / outstanding) * 100 : 0;
                      return (
                        <div
                          key={d.id}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => navigate(`/customers/${d.id}`)}
                        >
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-card-foreground truncate">
                              {d.name}
                            </p>
                            <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full bg-destructive/60 rounded-full transition-all"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-sm font-mono font-semibold text-destructive">
                              {formatCurrency(d.balance)}
                            </p>
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
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  P&L TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === "pl" && (
        <>
          {/* Period selector */}
          <div className="flex gap-1.5 flex-wrap">
            {(["month", "lastmonth", "year", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* ── "Kitna Kamaya" hero card ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-5 shadow-sm ${isProfit ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}
          >
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              NET PROFIT — {periodLabels[period].toUpperCase()}
            </p>
            <p
              className={`text-3xl font-display font-bold ${isProfit ? "text-success" : "text-destructive"}`}
            >
              {isProfit ? "+" : ""}
              {formatCurrency(netProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {revenue > 0
                ? `Profit margin: ${profitMargin}%`
                : "Koi sale nahi is period mein"}
            </p>
          </motion.div>

          {/* ── P&L breakdown cards ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Revenue",
                val: revenue,
                icon: ArrowUpRight,
                cls: "text-primary",
                bg: "bg-primary/10",
                hint: "Sales + credit given",
              },
              {
                label: "Expenses",
                val: totalExpenses,
                icon: Receipt,
                cls: "text-warning",
                bg: "bg-warning/10",
                hint: `${plExps.length} expense entries`,
              },
              {
                label: "Gross Profit",
                val: grossProfit,
                icon: TrendingUp,
                cls: grossProfit >= 0 ? "text-success" : "text-destructive",
                bg: grossProfit >= 0 ? "bg-success/10" : "bg-destructive/10",
                hint: hasCogsData ? "Revenue − COGS" : "COGS not tracked",
              },
              {
                label: "Net Profit",
                val: netProfit,
                icon: DollarSign,
                cls: isProfit ? "text-success" : "text-destructive",
                bg: isProfit ? "bg-success/10" : "bg-destructive/10",
                hint: "Gross Profit − Expenses",
              },
            ].map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card rounded-xl border border-border p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${c.bg}`}>
                    <c.icon className={`w-3.5 h-3.5 ${c.cls}`} />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {c.label}
                  </p>
                </div>
                <p className={`text-xl font-display font-bold ${c.cls}`}>
                  {formatCurrency(Math.abs(c.val))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {c.hint}
                </p>
              </motion.div>
            ))}
          </div>

          {/* COGS note if no product cost data */}
          {!hasCogsData && products.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Package className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Cost tracking not active.
                </span>{" "}
                Add cost prices to your products to see accurate gross profit.
                Without it, Revenue = Gross Profit.
              </p>
            </div>
          )}

          {/* ── Monthly P&L Chart ── */}
          {plBarData.some((d) => d.revenue > 0 || d.expenses > 0) && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <h3 className="font-display font-semibold text-sm text-card-foreground mb-4">
                Monthly Revenue vs Expenses
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={plBarData} barGap={4}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(220, 13%, 89%)"
                  />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: unknown) => formatCurrency(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar
                    dataKey="revenue"
                    fill={COLORS.profit}
                    name="Revenue"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    fill={COLORS.expense}
                    name="Expenses"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Expense Breakdown ── */}
          {expBreakdown.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-semibold text-sm text-card-foreground">
                  Expense Breakdown
                </h3>
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                  {formatCurrency(totalExpenses)} total
                </span>
              </div>
              <div className="divide-y divide-border">
                {expBreakdown.map(([cat, amt]) => {
                  const pct =
                    totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                  // Strip "cat_" prefix and capitalize
                  const label = cat
                    .replace("cat_", "")
                    .replace(/^\w/, (c) => c.toUpperCase());
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-3 px-5 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-card-foreground">
                            {label}
                          </p>
                          <p className="text-sm font-mono font-semibold text-warning">
                            {formatCurrency(amt)}
                          </p>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-warning/60 rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {revenue === 0 && totalExpenses === 0 && (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">
                No data for {periodLabels[period]}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try selecting a different time period
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
