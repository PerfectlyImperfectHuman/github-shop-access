import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, AlertCircle } from "lucide-react";
import { getCustomers, addTransaction, getCustomerBalance, getProducts, getProduct, getCustomer } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Customer, Product } from "@/types";

export default function NewTransaction() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState<"credit" | "payment">("credit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creditWarning, setCreditWarning] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getCustomers(true), getProducts(true)]).then(([c, p]) => {
      setCustomers(c);
      setProducts(p);
    });
  }, []);

  useEffect(() => {
    if (customerId) {
      getCustomerBalance(customerId).then(setBalance);
    } else {
      setBalance(null);
    }
  }, [customerId]);

  // Auto-fill amount from product
  useEffect(() => {
    if (productId && quantity) {
      const prod = products.find(p => p.id === productId);
      if (prod) {
        setAmount((prod.price * Number(quantity)).toString());
        setDescription(prod.name + (Number(quantity) > 1 ? ` × ${quantity}` : ""));
      }
    }
  }, [productId, quantity, products]);

  // Credit limit check
  useEffect(() => {
    if (customerId && type === "credit" && amount) {
      getCustomer(customerId).then(c => {
        if (c && c.creditLimit > 0 && balance !== null) {
          const newBalance = balance + Number(amount);
          if (newBalance > c.creditLimit) {
            setCreditWarning(`This will exceed credit limit of ${formatCurrency(c.creditLimit)} by ${formatCurrency(newBalance - c.creditLimit)}`);
          } else {
            setCreditWarning("");
          }
        } else {
          setCreditWarning("");
        }
      });
    } else {
      setCreditWarning("");
    }
  }, [customerId, type, amount, balance]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error("Select a customer"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }

    // Check stock
    if (productId && quantity && type === "credit") {
      const prod = await getProduct(productId);
      if (prod && prod.stock < Number(quantity)) {
        toast.error(`Only ${prod.stock} ${prod.unit} in stock`);
        return;
      }
    }

    setSubmitting(true);
    await addTransaction({
      customerId,
      type,
      amount: amt,
      description,
      date: new Date().toISOString(),
      productId: productId || undefined,
      quantity: quantity ? Number(quantity) : undefined,
    });
    toast.success(`${type === "credit" ? "Credit" : "Payment"} of ${formatCurrency(amt)} recorded`);
    setAmount("");
    setDescription("");
    setProductId("");
    setQuantity("");
    const newBal = await getCustomerBalance(customerId);
    setBalance(newBal);
    setSubmitting(false);
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-5 lg:p-6 shadow-sm"
      >
        <h3 className="font-display font-semibold text-lg mb-5 text-card-foreground">Record Transaction</h3>

        {/* Type Toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden mb-5">
          <button
            type="button"
            onClick={() => setType("credit")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              type === "credit" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" /> Credit (Udhar)
          </button>
          <button
            type="button"
            onClick={() => setType("payment")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              type === "payment" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" /> Payment (Wapsi)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Select */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Customer *</label>
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
            <div className={`px-4 py-3 rounded-lg text-sm font-medium ${balance > 0 ? "bg-destructive/10 text-destructive" : balance < 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
              Current Balance: {balance > 0 ? `${formatCurrency(balance)} due` : balance < 0 ? `${formatCurrency(balance)} advance` : "Settled ✓"}
            </div>
          )}

          {/* Product (only for credit) */}
          {type === "credit" && products.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Product (optional)</label>
                <select
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="1"
                  disabled={!productId}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amount (Rs.) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Credit Limit Warning */}
          {creditWarning && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-warning/10 text-warning text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {creditWarning}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optional)</label>
            <input
              type="text"
              placeholder="e.g. Ration, Partial payment..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded-xl text-sm font-bold transition ${
              type === "credit"
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-success text-success-foreground hover:opacity-90"
            } disabled:opacity-50`}
          >
            {submitting ? "Saving..." : `Record ${type === "credit" ? "Credit (Udhar)" : "Payment (Wapsi)"}`}
          </button>
        </form>

        {/* Quick navigate */}
        {customerId && (
          <button
            onClick={() => navigate(`/customers/${customerId}`)}
            className="w-full mt-3 text-sm text-primary hover:underline"
          >
            View Customer Ledger →
          </button>
        )}
      </motion.div>
    </div>
  );
}
