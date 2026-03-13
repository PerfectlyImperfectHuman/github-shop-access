/**
 * DailyClose — End-of-day register closing report
 *
 * Shows for the selected date:
 *   Opening cash (user-entered, saved to localStorage per date)
 *   Cash Sales total (POS cash sales, type "sale")
 *   Payments Received from customers (type "payment")
 *   Credit Given (Udhar, type "credit")
 *   Closing Cash = Opening + Cash Sales + Payments Received
 *
 * Printable as an 80mm thermal report.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Printer, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Wallet, DollarSign, ClipboardCheck, RefreshCw,
} from "lucide-react";
import { getDailySummary, initSettings, getTransactions, getCustomer } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DailySummary, Transaction } from "@/types";

interface EnrichedTxn extends Transaction { customerName?: string; }

export default function DailyClose() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<EnrichedTxn[]>([]);
  const [shopName, setShopName] = useState("My Shop");
  const [shopPhone, setShopPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState("");

  // Persist opening cash per date in localStorage
  const openingCashKey = `openingCash:${date}`;

  useEffect(() => {
    setOpeningCash(localStorage.getItem(openingCashKey) || "");
  }, [date]);

  useEffect(() => {
    if (openingCash) localStorage.setItem(openingCashKey, openingCash);
    else localStorage.removeItem(openingCashKey);
  }, [openingCash]);

  async function load() {
    setLoading(true);
    const [s, settings] = await Promise.all([getDailySummary(date), initSettings()]);
    setSummary(s);
    setShopName(settings.shopName);
    setShopPhone(settings.phone || "");

    // Load today's transactions (enriched with customer names)
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const allTxns = await getTransactions();
    const dayTxns = allTxns.filter(t => {
      const d = new Date(t.date);
      return d >= dayStart && d <= dayEnd;
    });
    const enriched = await Promise.all(dayTxns.map(async t => {
      const c = t.customerId ? await getCustomer(t.customerId) : undefined;
      return { ...t, customerName: c?.name };
    }));
    setTransactions(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, [date]);

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split("T")[0];
    if (newDate <= today) setDate(newDate);
  }

  const opening = parseFloat(openingCash) || 0;
  const closingCash = opening + (summary?.cashSales || 0) + (summary?.paymentsReceived || 0);
  const netBalance = (summary?.cashSales || 0) + (summary?.paymentsReceived || 0) - (summary?.creditGiven || 0);

  const isToday = date === today;
  const displayDate = new Date(date).toLocaleDateString("en-PK", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const printDate = new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* ── Print-only closing report ── */}
      <div className="receipt-print-area hidden print:block">
        <div style={{ fontFamily: "monospace", fontSize: "12px", width: "80mm", margin: "0 auto", padding: "4mm" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold" }}>{shopName}</div>
            {shopPhone && <div style={{ fontSize: "11px" }}>{shopPhone}</div>}
            <div style={{ fontSize: "13px", fontWeight: "bold", marginTop: "6px" }}>DAILY CLOSING REPORT</div>
            <div style={{ fontSize: "11px" }}>{printDate}</div>
            <div style={{ fontSize: "10px", color: "#555" }}>Printed: {printTime}</div>
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

          {/* Cash Summary */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>CASH SUMMARY</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
              <span>Opening Cash</span>
              <span>Rs. {opening.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
              <span>Cash Sales ({summary?.salesCount || 0})</span>
              <span>Rs. {(summary?.cashSales || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
              <span>Payments Received ({summary?.paymentCount || 0})</span>
              <span>Rs. {(summary?.paymentsReceived || 0).toLocaleString()}</span>
            </div>
            <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px" }}>
              <span>CLOSING CASH</span>
              <span>Rs. {closingCash.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

          {/* Credit summary */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>UDHAR (CREDIT)</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Credit Given ({summary?.creditCount || 0})</span>
              <span>Rs. {(summary?.creditGiven || 0).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

          {/* Transaction list */}
          {transactions.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>TRANSACTIONS</div>
              {transactions.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
                  <span style={{ maxWidth: "120px", overflow: "hidden" }}>
                    {t.type === "sale" ? "💵" : t.type === "credit" ? "↑" : "↓"}{" "}
                    {t.customerName || t.description?.slice(0, 20) || t.type}
                  </span>
                  <span>{t.type === "payment" ? "-" : "+"}Rs. {t.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
          <div style={{ textAlign: "center", fontSize: "10px" }}>Dukan Manager · End of Day</div>
        </div>
      </div>

      {/* ── Main UI ── */}
      <div className="space-y-5 animate-fade-in print:hidden max-w-2xl mx-auto">

        {/* Date Navigator */}
        <div className="flex items-center gap-3">
          <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-display font-semibold text-foreground">{displayDate}</p>
            {isToday && <p className="text-xs text-primary font-medium">Today</p>}
          </div>
          <button onClick={() => shiftDate(1)} disabled={isToday}
            className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <input type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={load} className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Opening Cash Input */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-semibold text-sm text-card-foreground">Opening Cash (Register Start)</h3>
              </div>
              <input
                type="number"
                placeholder="Enter opening cash in register..."
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground text-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Saved automatically for this date</p>
            </motion.div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Cash Sales", value: summary?.cashSales || 0, count: summary?.salesCount, icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
                { label: "Payments Received", value: summary?.paymentsReceived || 0, count: summary?.paymentCount, icon: TrendingDown, color: "text-success", bg: "bg-success/10" },
                { label: "Credit Given", value: summary?.creditGiven || 0, count: summary?.creditCount, icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" },
              ].map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium leading-tight">{c.label}</p>
                    <div className={`p-1.5 rounded-lg ${c.bg}`}>
                      <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                    </div>
                  </div>
                  <p className={`text-xl font-display font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
                  {c.count !== undefined && <p className="text-[11px] text-muted-foreground mt-0.5">{c.count} transaction{c.count !== 1 ? "s" : ""}</p>}
                </motion.div>
              ))}
            </div>

            {/* Closing Summary */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-semibold text-sm text-card-foreground">Register Summary</h3>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Opening Cash</span>
                  <span className="font-mono font-medium">{formatCurrency(opening)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">+ Cash Sales</span>
                  <span className="font-mono font-medium text-primary">{formatCurrency(summary?.cashSales || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">+ Payments Received</span>
                  <span className="font-mono font-medium text-success">{formatCurrency(summary?.paymentsReceived || 0)}</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-card-foreground">Closing Cash</span>
                  <span className="font-display font-bold text-xl text-primary font-mono">{formatCurrency(closingCash)}</span>
                </div>

                <div className="h-px bg-border my-1" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Credit Given (Udhar)</span>
                  <span className="font-mono text-destructive">− {formatCurrency(summary?.creditGiven || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Net Cash Flow</span>
                  <span className={`font-mono font-semibold ${netBalance >= 0 ? "text-success" : "text-destructive"}`}>
                    {netBalance >= 0 ? "+" : ""}{formatCurrency(Math.abs(netBalance))}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Transactions for the day */}
            {transactions.length > 0 && (
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="font-display font-semibold text-sm text-card-foreground">
                    {transactions.length} Transaction{transactions.length !== 1 ? "s" : ""} Today
                  </h3>
                </div>
                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          t.type === "sale" ? "bg-primary/10 text-primary"
                          : t.type === "credit" ? "bg-destructive/10 text-destructive"
                          : "bg-success/10 text-success"
                        }`}>
                          {t.type === "sale" ? "Cash" : t.type === "credit" ? "Udhar" : "Wapsi"}
                        </span>
                        <p className="text-sm text-card-foreground truncate">
                          {t.customerName || t.description?.slice(0, 30) || "—"}
                        </p>
                      </div>
                      <p className={`text-sm font-mono font-semibold shrink-0 ml-3 ${
                        t.type === "sale" ? "text-primary"
                        : t.type === "credit" ? "text-destructive"
                        : "text-success"
                      }`}>
                        {t.type === "payment" ? "−" : "+"}{formatCurrency(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transactions.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-10 text-center shadow-sm">
                <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium">No transactions for this date</p>
              </div>
            )}

            {/* Print Button */}
            <button onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition">
              <Printer className="w-4 h-4" /> Print Daily Closing Report
            </button>
          </>
        )}
      </div>
    </>
  );
}
