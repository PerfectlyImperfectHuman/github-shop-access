import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getCustomers, addTransaction, getCustomerBalance } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Customer } from "@/types";

export default function NewTransaction() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState<"credit" | "payment">("credit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCustomers(true).then(setCustomers);
  }, []);

  useEffect(() => {
    if (customerId) {
      getCustomerBalance(customerId).then(setBalance);
    } else {
      setBalance(null);
    }
  }, [customerId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error("Select a customer"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }

    setSubmitting(true);
    await addTransaction({
      customerId,
      type,
      amount: amt,
      description,
      date: new Date().toISOString(),
    });
    toast.success(`${type === "credit" ? "Credit" : "Payment"} of ${formatCurrency(amt)} recorded`);
    setAmount("");
    setDescription("");
    const newBal = await getCustomerBalance(customerId);
    setBalance(newBal);
    setSubmitting(false);
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-6 shadow-sm"
      >
        <h3 className="font-display font-semibold text-lg mb-6 text-card-foreground">Record Transaction</h3>

        {/* Type Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setType("credit")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${
              type === "credit" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" /> Credit (Udhaar)
          </button>
          <button
            type="button"
            onClick={() => setType("payment")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${
              type === "payment" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" /> Payment Received
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Select */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Customer</label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Balance Display */}
          {balance !== null && (
            <div className={`px-4 py-3 rounded-lg text-sm font-medium ${balance > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              Current Balance: {balance > 0 ? `${formatCurrency(balance)} due` : balance < 0 ? `${formatCurrency(balance)} advance` : "Settled"}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description (optional)</label>
            <input
              type="text"
              placeholder="e.g. Groceries, Partial payment..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition ${
              type === "credit"
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-success text-success-foreground hover:opacity-90"
            } disabled:opacity-50`}
          >
            {submitting ? "Saving..." : `Record ${type === "credit" ? "Credit" : "Payment"}`}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
