import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ArrowLeft, Phone, MapPin, Printer, User, Wallet } from "lucide-react";
import { getCustomer, getTransactions, getCustomerBalance } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { Customer, Transaction } from "@/types";

export default function CustomerLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [c, txns, bal] = await Promise.all([
        getCustomer(id!),
        getTransactions(id),
        getCustomerBalance(id!),
      ]);
      if (c) setCustomer(c);
      setTransactions(txns);
      setBalance(bal);
      setLoading(false);
    }
    load();
  }, [id]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Customer not found.</p>
        <button onClick={() => navigate("/customers")} className="mt-4 text-primary hover:underline">← Back to Customers</button>
      </div>
    );
  }

  // Running balance calculation
  const reversedTxns = [...transactions].reverse();
  let runningBalance = 0;
  const ledgerRows = reversedTxns.map(t => {
    runningBalance += t.type === "credit" ? t.amount : -t.amount;
    return { ...t, runningBalance };
  }).reverse();

  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === "payment").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back Button */}
      <button onClick={() => navigate("/customers")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition no-print">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </button>

      {/* Customer Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-5 shadow-sm print-area"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-card-foreground">{customer.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>}
                {customer.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.address}</span>}
                {customer.cnic && <span>CNIC: {customer.cnic}</span>}
              </div>
            </div>
          </div>
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:opacity-90 transition no-print">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="p-3 rounded-lg bg-destructive/10">
            <p className="text-xs text-muted-foreground">Total Credit</p>
            <p className="text-lg font-display font-bold text-destructive">{formatCurrency(totalCredit)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-lg font-display font-bold text-success">{formatCurrency(totalPayments)}</p>
          </div>
          <div className={`p-3 rounded-lg ${balance > 0 ? "bg-warning/10" : "bg-success/10"}`}>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={`text-lg font-display font-bold ${balance > 0 ? "text-warning" : "text-success"}`}>
              {balance > 0 ? formatCurrency(balance) : balance < 0 ? `${formatCurrency(balance)} adv` : "Settled ✓"}
            </p>
          </div>
        </div>
        {customer.creditLimit > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Credit Limit: {formatCurrency(customer.creditLimit)} • 
              {balance > customer.creditLimit 
                ? <span className="text-destructive font-medium ml-1">⚠ Exceeded by {formatCurrency(balance - customer.creditLimit)}</span>
                : <span className="text-success font-medium ml-1">Available: {formatCurrency(customer.creditLimit - Math.max(0, balance))}</span>
              }
            </p>
          </div>
        )}
      </motion.div>

      {/* Ledger Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden print-area">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm text-card-foreground">Transaction Ledger ({transactions.length})</h3>
        </div>
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Credit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Payment</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgerRows.map(row => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(row.date)}</td>
                    <td className="px-4 py-2.5 text-card-foreground">{row.description || (row.type === "credit" ? "Udhar" : "Payment")}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-destructive">
                      {row.type === "credit" ? formatCurrency(row.amount) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-success">
                      {row.type === "payment" ? formatCurrency(row.amount) : "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${row.runningBalance > 0 ? "text-destructive" : "text-success"}`}>
                      {formatCurrency(row.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
