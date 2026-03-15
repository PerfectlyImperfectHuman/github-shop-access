import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Printer, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Wallet, ClipboardCheck, RefreshCw,
} from "lucide-react";
import { getDailySummary, initSettings, getTransactions, getCustomer } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import type { DailySummary, Transaction } from "@/types";

interface EnrichedTxn extends Transaction { customerName?: string; }

export default function DailyClose() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate]           = useState(today);
  const [summary, setSummary]     = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<EnrichedTxn[]>([]);
  const [shopName, setShopName]   = useState("My Shop");
  const [shopPhone, setShopPhone] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("Thank you!");
  const [loading, setLoading]     = useState(true);
  const [openingCash, setOpeningCash] = useState("");
  const openingCashKey = `openingCash:${date}`;

  useEffect(() => { setOpeningCash(localStorage.getItem(openingCashKey) || ""); }, [date]);
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
    setReceiptFooter(settings.receiptFooter || "Thank you!");

    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const allTxns  = await getTransactions();
    const dayTxns  = allTxns.filter(t => { const d = new Date(t.date); return d >= dayStart && d <= dayEnd; });
    const enriched = await Promise.all(dayTxns.map(async t => {
      const c = t.customerId ? await getCustomer(t.customerId) : undefined;
      return { ...t, customerName: c?.name };
    }));
    setTransactions(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, [date]);

  function shiftDate(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days);
    const n = d.toISOString().split("T")[0];
    if (n <= today) setDate(n);
  }

  const opening     = parseFloat(openingCash) || 0;
  const cashSales   = summary?.cashSales || 0;
  const payments    = summary?.paymentsReceived || 0;
  const credit      = summary?.creditGiven || 0;
  const closingCash = opening + cashSales + payments;
  const isToday     = date === today;

  // Compact date: "Sun, 15 Mar 2026"
  const shortDate = new Date(date).toLocaleDateString("en-PK", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  const printDate = new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Print-only closing report */}
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
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>CASH SUMMARY</div>
            {[
              ["Opening Cash",             `Rs. ${opening.toLocaleString()}`],
              [`Cash Sales (${summary?.salesCount || 0})`, `Rs. ${cashSales.toLocaleString()}`],
              [`Payments Received (${summary?.paymentCount || 0})`, `Rs. ${payments.toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px" }}>
              <span>CLOSING CASH</span><span>Rs. {closingCash.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>UDHAR GIVEN ({summary?.creditCount || 0})</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Total Credit Given</span><span>Rs. {credit.toLocaleString()}</span>
            </div>
          </div>
          {transactions.length > 0 && (
            <>
              <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
              <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>TRANSACTIONS</div>
              {transactions.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
                  <span style={{ maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.type === "sale" ? "💵" : t.type === "credit" ? "↑" : "↓"}{" "}
                    {t.customerName || t.description?.slice(0, 22) || t.type}
                  </span>
                  <span>{t.type === "payment" ? "−" : "+"}Rs.{t.amount.toLocaleString()}</span>
                </div>
              ))}
            </>
          )}
          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
          <div style={{ textAlign: "center", fontSize: "10px" }}>{receiptFooter}</div>
          <div style={{ textAlign: "center", fontSize: "9px", marginTop: "4px", color: "#888" }}>Bahi – Digital Bahi Khata</div>
        </div>
      </div>

      {/* Main UI */}
      <div className="space-y-4 animate-fade-in print:hidden max-w-lg mx-auto">

        {/* Date navigator — compact single row */}
        <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2.5 shadow-sm">
          <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{shortDate}</p>
            {isToday && <p className="text-[11px] text-primary font-medium leading-none mt-0.5">Today</p>}
          </div>

          <button onClick={() => shiftDate(1)} disabled={isToday}
            className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground disabled:opacity-30 shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>

          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
            className="w-[130px] px-2.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
          />

          <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground shrink-0" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Opening Cash */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Opening Cash (Register Start)
              </label>
              <input
                type="number"
                placeholder="0"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground text-2xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Saved automatically for this date</p>
            </div>

            {/* Summary Cards — 2+1 layout, fix the orphaned card */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Cash Sales",         value: cashSales,  count: summary?.salesCount,   icon: Wallet,      color: "text-primary",     bg: "bg-primary/10" },
                { label: "Payments Received",  value: payments,   count: summary?.paymentCount, icon: TrendingDown, color: "text-success",    bg: "bg-success/10" },
              ].map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium leading-tight pr-1">{c.label}</p>
                    <div className={`p-1.5 rounded-lg ${c.bg} shrink-0`}>
                      <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                    </div>
                  </div>
                  <p className={`text-xl font-display font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.count ?? 0} txn{(c.count ?? 0) !== 1 ? "s" : ""}</p>
                </motion.div>
              ))}
            </div>

            {/* Credit given — full width card */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Credit Given (Udhar)</p>
                <p className="text-xl font-display font-bold text-destructive mt-0.5">{formatCurrency(credit)}</p>
                <p className="text-[11px] text-muted-foreground">{summary?.creditCount ?? 0} txn{(summary?.creditCount ?? 0) !== 1 ? "s" : ""}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <TrendingUp className="w-5 h-5 text-destructive" />
              </div>
            </motion.div>

            {/* Register Summary */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-semibold text-sm text-card-foreground">Register Summary</h3>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ["Opening Cash", formatCurrency(opening), "text-foreground"],
                  ["+ Cash Sales", formatCurrency(cashSales), "text-primary"],
                  ["+ Payments Received", formatCurrency(payments), "text-success"],
                ].map(([k, v, cls]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{k}</span>
                    <span className={`font-mono font-medium ${cls}`}>{v}</span>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-card-foreground">Closing Cash</span>
                  <span className="font-display font-bold text-xl text-primary font-mono">{formatCurrency(closingCash)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Credit Given (reduces cash flow)</span>
                  <span className="font-mono text-destructive">− {formatCurrency(credit)}</span>
                </div>
              </div>
            </motion.div>

            {/* Today's transactions */}
            {transactions.length > 0 && (
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="font-display font-semibold text-sm text-card-foreground">
                    {transactions.length} Transaction{transactions.length !== 1 ? "s" : ""}
                  </h3>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {transactions.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        t.type === "sale"    ? "bg-primary/10 text-primary"
                        : t.type === "credit" ? "bg-destructive/10 text-destructive"
                        : "bg-success/10 text-success"
                      }`}>
                        {t.type === "sale" ? "Cash" : t.type === "credit" ? "Udhar" : "Wapsi"}
                      </span>
                      <p className="text-sm text-card-foreground truncate flex-1">
                        {t.customerName || t.description?.slice(0, 28) || "—"}
                      </p>
                      <p className={`text-sm font-mono font-semibold shrink-0 ${
                        t.type === "sale"    ? "text-primary"
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
