import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, AlertCircle, Search, UserPlus } from "lucide-react";
import { getCustomers, addTransaction, getCustomerBalance, getProducts, getProduct, getCustomer } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SelectField } from "@/components/ui/select-field";
import type { Customer, Product } from "@/types";

export default function NewTransaction() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [creditWarning, setCreditWarning] = useState("");

  const [searchParams] = useSearchParams();
  const [type, setType] = useState<"credit" | "payment">(
    searchParams.get("type") === "payment" ? "payment" : "credit"
  );

  const navigate = useNavigate();

  // FIX: Load all customers (not just active with buggy boolean filter)
  useEffect(() => {
    Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
      setCustomers(c.filter(x => x.isActive));
      setProducts(p.filter(x => x.isActive));
    });
  }, []);

  // Update type when URL param changes
  useEffect(() => {
    const t = searchParams.get("type");
    if (t === "payment" || t === "credit") setType(t);
  }, [searchParams]);

  // Load customer balance
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
        setAmount((prod.price * Number(quantity)).toFixed(0));
        setDescription(prod.name + (Number(quantity) > 1 ? ` × ${quantity}` : ""));
      }
    }
  }, [productId, quantity, products]);

  // Credit limit warning
  useEffect(() => {
    if (customerId && type === "credit" && amount) {
      getCustomer(customerId).then(c => {
        if (c && c.creditLimit > 0 && balance !== null) {
          const newBalance = balance + Number(amount);
          if (newBalance > c.creditLimit) {
            setCreditWarning(`Will exceed credit limit of ${formatCurrency(c.creditLimit)} by ${formatCurrency(newBalance - c.creditLimit)}`);
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

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const customerOptions = filteredCustomers.map(c => ({
    value: c.id,
    label: c.name,
    sublabel: c.phone || undefined,
  }));

  const productOptions = [
    { value: "", label: "No product linked" },
    ...products.map(p => ({
      value: p.id,
      label: p.name,
      sublabel: `${p.stock} ${p.unit} in stock`,
    })),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error("Please select a customer"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Please enter a valid amount"); return; }

    if (productId && quantity && type === "credit") {
      const prod = await getProduct(productId);
      if (prod && prod.stock < Number(quantity)) {
        toast.error(`Only ${prod.stock} ${prod.unit} available in stock`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await addTransaction({
        customerId,
        type,
        amount: amt,
        description: description.trim(),
        date: new Date(date).toISOString(),
        productId: productId || undefined,
        quantity: quantity ? Number(quantity) : undefined,
      });
      toast.success(`${type === "credit" ? "Credit (Udhar)" : "Payment (Wapsi)"} of ${formatCurrency(amt)} recorded`);
      setAmount("");
      setDescription("");
      setProductId("");
      setQuantity("");
      const newBal = await getCustomerBalance(customerId);
      setBalance(newBal);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
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
              type === "credit" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" /> Credit (Udhar)
          </button>
          <button
            type="button"
            onClick={() => setType("payment")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              type === "payment" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" /> Payment (Wapsi)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Search + Select */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Customer *</label>
            {customers.length === 0 ? (
              <div className="px-4 py-4 rounded-lg border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground mb-2">No customers yet</p>
                <button type="button" onClick={() => navigate("/customers")} className="flex items-center gap-1.5 mx-auto text-xs text-primary font-medium hover:underline">
                  <UserPlus className="w-3.5 h-3.5" /> Add your first customer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <SelectField
                  value={customerId}
                  onValueChange={setCustomerId}
                  options={customerOptions}
                  placeholder="Select a customer..."
                />
              </div>
            )}
          </div>

          {/* Balance Display */}
          {balance !== null && (
            <div className={`px-4 py-3 rounded-lg text-sm font-medium ${balance > 0 ? "bg-destructive/10 text-destructive" : balance < 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
              Current Balance: {balance > 0 ? `${formatCurrency(balance)} due` : balance < 0 ? `${formatCurrency(Math.abs(balance))} advance` : "Settled ✓"}
            </div>
          )}

          {/* Product (only for credit) */}
          {type === "credit" && products.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Product (optional)</label>
                <SelectField
                  value={productId}
                  onValueChange={(v) => { setProductId(v); if (!v) setQuantity(""); }}
                  options={productOptions}
                  placeholder="Select product..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quantity</label>
                <input
                  type="number" min="1" value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="1" disabled={!productId}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amount (Rs.) *</label>
            <input
              type="number" step="1" min="1" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground text-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Credit Limit Warning */}
          {creditWarning && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-warning/10 text-warning text-sm border border-warning/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {creditWarning}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optional)</label>
            <input
              type="text" placeholder="e.g. Ration, Partial payment, Milk..."
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit" disabled={submitting || !customerId}
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition active:scale-[0.98] ${
              type === "credit"
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-success text-success-foreground hover:opacity-90"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {submitting ? "Saving..." : `Record ${type === "credit" ? "Credit (Udhar)" : "Payment (Wapsi)"}`}
          </button>
        </form>

        {customerId && (
          <button
            onClick={() => navigate(`/customers/${customerId}`)}
            className="w-full mt-3 py-2 text-sm text-primary hover:underline text-center"
          >
            View Customer Ledger →
          </button>
        )}
      </motion.div>
    </div>
  );
}
