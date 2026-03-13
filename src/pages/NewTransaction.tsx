/**
 * NewTransaction — Cart-based Udhar (Credit) + simple Payment entry
 *
 * UDHAR mode: Scan/search items → cart → select customer → record as credit
 * PAYMENT mode: Select customer → enter amount → record payment
 *
 * Barcode scan: looks up product by SKU/name → adds to cart (qty++ if already there)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, ArrowDownRight, Search, UserPlus, Scan, Plus, Minus,
  Trash2, ShoppingCart, X, Check, Printer, ChevronDown, UserCircle,
  AlertCircle, Package,
} from "lucide-react";
import {
  getCustomers, addTransaction, getCustomerBalance, getProducts,
  updateProductStock, getCustomer, initSettings,
} from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SelectField } from "@/components/ui/select-field";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { Customer, Product, Settings } from "@/types";

interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
}

interface SavedUdhar {
  customer: Customer;
  items: CartItem[];
  total: number;
  date: string;
  receiptNo: string;
}

export default function NewTransaction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialMode = searchParams.get("type") === "payment" ? "payment" : "credit";
  const [mode, setMode] = useState<"credit" | "payment">(initialMode);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // — Shared state —
  const [customerId, setCustomerId] = useState(searchParams.get("customer") || "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  // — Udhar / Credit cart state —
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [udharNote, setUdharNote] = useState("");
  const [savedUdhar, setSavedUdhar] = useState<SavedUdhar | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [creditWarning, setCreditWarning] = useState("");

  // — Payment state —
  const [payAmount, setPayAmount] = useState("");
  const [payDescription, setPayDescription] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    Promise.all([getCustomers(), getProducts(), initSettings()]).then(([c, p, s]) => {
      setCustomers(c.filter(x => x.isActive));
      setProducts(p.filter(x => x.isActive));
      setSettings(s);
    });
  }, []);

  // Update mode from URL
  useEffect(() => {
    const t = searchParams.get("type");
    if (t === "payment" || t === "credit") setMode(t);
  }, [searchParams]);

  // Load customer from URL param
  useEffect(() => {
    const cid = searchParams.get("customer");
    if (cid) {
      getCustomer(cid).then(c => {
        if (c) { setSelectedCustomer(c); setCustomerId(cid); }
      });
    }
  }, []);

  // Update balance when customer changes
  useEffect(() => {
    if (customerId) {
      getCustomerBalance(customerId).then(setBalance);
    } else {
      setBalance(null);
    }
  }, [customerId]);

  // Credit limit warning
  const cartTotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  useEffect(() => {
    if (!customerId || mode !== "credit" || cartTotal === 0) { setCreditWarning(""); return; }
    if (selectedCustomer && selectedCustomer.creditLimit > 0 && balance !== null) {
      const newBal = balance + cartTotal;
      if (newBal > selectedCustomer.creditLimit) {
        setCreditWarning(`Will exceed credit limit of ${formatCurrency(selectedCustomer.creditLimit)} by ${formatCurrency(newBal - selectedCustomer.creditLimit)}`);
      } else {
        setCreditWarning("");
      }
    } else {
      setCreditWarning("");
    }
  }, [customerId, mode, cartTotal, balance, selectedCustomer]);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [...prev, { product, qty: 1, unitPrice: product.price }];
    });
    setProductSearch("");
    setShowProductSearch(false);
  }

  function updateQty(id: string, delta: number) {
    setCart(prev =>
      prev.map(i => i.product.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  }

  function updatePrice(id: string, price: number) {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, unitPrice: price } : i));
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i.product.id !== id));
  }

  // ── Barcode scan ──────────────────────────────────────────────────────────

  function handleScan(code: string) {
    const product = products.find(
      p => p.sku?.toLowerCase() === code.toLowerCase() ||
           p.name.toLowerCase() === code.toLowerCase()
    );
    if (product) {
      addToCart(product);
      toast.success(`Added: ${product.name}`);
    } else {
      toast.error(`No product for barcode "${code}". Add it from the Products page first.`);
    }
    setShowScanner(false);
  }

  // ── Customer selection ────────────────────────────────────────────────────

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerId(c.id);
    setShowCustomerPicker(false);
    setCustomerSearch("");
  }

  // ── Save Udhar (Credit) ───────────────────────────────────────────────────

  async function handleSaveUdhar() {
    if (!customerId) { toast.error("Please select a customer"); return; }
    if (cart.length === 0) { toast.error("Cart is empty — add at least one item"); return; }

    setSubmitting(true);
    try {
      const total = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
      const itemsSummary = cart.map(i =>
        `${i.product.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`
      ).join(", ");
      const description = udharNote.trim()
        ? `${udharNote} (${itemsSummary})`
        : itemsSummary;

      // Record the credit transaction
      await addTransaction({
        customerId,
        type: "credit",
        amount: total,
        description,
        date: new Date(date).toISOString(),
      });

      // Update stock for all cart items
      await Promise.all(cart.map(i => updateProductStock(i.product.id, -i.qty)));

      const customer = selectedCustomer!;
      setSavedUdhar({
        customer,
        items: [...cart],
        total,
        date: new Date(date).toISOString(),
        receiptNo: `UDH-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      });
      setShowReceipt(true);
      toast.success(`Udhar of ${formatCurrency(total)} recorded for ${customer.name}`);

      // Refresh balance
      getCustomerBalance(customerId).then(setBalance);
      // Reset cart
      setCart([]);
      setUdharNote("");
    } catch (err) {
      toast.error("Failed to record udhar. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Save Payment ──────────────────────────────────────────────────────────

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error("Please select a customer"); return; }
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error("Please enter a valid amount"); return; }

    setSubmitting(true);
    try {
      await addTransaction({
        customerId,
        type: "payment",
        amount: amt,
        description: payDescription.trim() || "Payment",
        date: new Date(date).toISOString(),
      });
      toast.success(`Payment of ${formatCurrency(amt)} recorded`);
      setPayAmount("");
      setPayDescription("");
      const newBal = await getCustomerBalance(customerId);
      setBalance(newBal);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const shopName = settings?.shopName || "My Shop";
  const currency = settings?.currency || "Rs.";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Print-only Udhar receipt ── */}
      {savedUdhar && (
        <div className="receipt-print-area hidden print:block">
          <div style={{ fontFamily: "monospace", fontSize: "12px", width: "80mm", margin: "0 auto", padding: "4mm" }}>
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "16px", fontWeight: "bold" }}>{shopName}</div>
              <div style={{ fontSize: "10px", marginTop: "2px" }}>
                {new Date(savedUdhar.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div style={{ fontSize: "10px" }}>Receipt: {savedUdhar.receiptNo}</div>
            </div>
            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
            <div style={{ marginBottom: "6px", fontSize: "11px" }}>
              Customer: <strong>{savedUdhar.customer.name}</strong>
              {savedUdhar.customer.phone && <> | {savedUdhar.customer.phone}</>}
            </div>
            <div style={{ fontSize: "11px", marginBottom: "4px", fontStyle: "italic" }}>UDHAR (Credit)</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingBottom: "4px" }}>Item</th>
                  <th style={{ textAlign: "center" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {savedUdhar.items.map(item => (
                  <tr key={item.product.id}>
                    <td style={{ paddingBottom: "3px", maxWidth: "120px", wordBreak: "break-word" }}>{item.product.name}</td>
                    <td style={{ textAlign: "center" }}>{item.qty}</td>
                    <td style={{ textAlign: "right" }}>{item.unitPrice.toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>{(item.qty * item.unitPrice).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px" }}>
              <span>TOTAL UDHAR</span>
              <span>{currency} {savedUdhar.total.toLocaleString()}</span>
            </div>
            <div style={{ marginTop: "4px", fontSize: "10px", textAlign: "center" }}>
              * Charged to account (Udhar)
            </div>
            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ textAlign: "center", fontSize: "10px" }}>{settings?.receiptFooter || "Thank you!"}</div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto animate-fade-in print:hidden space-y-4">

        {/* ── Barcode Scanner Modal ── */}
        {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

        {/* ── Customer Picker Modal ── */}
        {showCustomerPicker && (
          <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCustomerPicker(false)}>
            <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display font-semibold text-card-foreground">Select Customer</h3>
                <button onClick={() => setShowCustomerPicker(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-3 border-b border-border">
                <input autoFocus type="text" placeholder="Search name or phone..."
                  value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredCustomers.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No customers found</p>
                  : filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => selectCustomer(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left transition">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{c.name}</p>
                        {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                      </div>
                    </button>
                  ))
                }
              </div>
              <div className="p-3 border-t border-border">
                <button onClick={() => { setShowCustomerPicker(false); navigate("/customers"); }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-primary font-medium hover:underline">
                  <UserPlus className="w-3.5 h-3.5" /> Add New Customer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Saved Receipt Modal ── */}
        <AnimatePresence>
          {showReceipt && savedUdhar && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
                className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-card-foreground">Udhar Recorded!</p>
                      <p className="text-xs text-muted-foreground">{savedUdhar.receiptNo}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowReceipt(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-semibold">{savedUdhar.customer.name}</span>
                  </div>
                  {savedUdhar.items.map(item => (
                    <div key={item.product.id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.product.name} ×{item.qty}</span>
                      <span className="font-mono">{formatCurrency(item.qty * item.unitPrice)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-destructive pt-1 border-t border-border">
                    <span>Total Udhar</span>
                    <span className="font-mono">{formatCurrency(savedUdhar.total)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button onClick={() => { setShowReceipt(false); navigate(`/customers/${savedUdhar.customer.id}`); }}
                    className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition text-center">
                    View Ledger →
                  </button>
                </div>
                <button onClick={() => setShowReceipt(false)} className="w-full text-xs text-muted-foreground hover:underline text-center">
                  Record Another
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mode Toggle ── */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button type="button" onClick={() => setMode("credit")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              mode === "credit" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            <ArrowUpRight className="w-4 h-4" /> Udhar (Credit)
          </button>
          <button type="button" onClick={() => setMode("payment")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              mode === "payment" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            <ArrowDownRight className="w-4 h-4" /> Payment (Wapsi)
          </button>
        </div>

        {/* ── Customer Selector (shared) ── */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Customer *</label>
          <button onClick={() => setShowCustomerPicker(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-input bg-background text-sm text-left hover:border-ring/50 transition">
            <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className={selectedCustomer ? "text-foreground font-medium" : "text-muted-foreground"}>
              {selectedCustomer ? selectedCustomer.name : "Select customer..."}
            </span>
            {selectedCustomer
              ? <button onClick={e => { e.stopPropagation(); setSelectedCustomer(null); setCustomerId(""); }}
                  className="ml-auto p-0.5 hover:text-destructive text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            }
          </button>

          {balance !== null && (
            <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
              balance > 0 ? "bg-destructive/10 text-destructive"
              : balance < 0 ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
            }`}>
              Current Balance:{" "}
              {balance > 0 ? `${formatCurrency(balance)} due`
               : balance < 0 ? `${formatCurrency(Math.abs(balance))} advance`
               : "Settled ✓"}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* UDHAR (Credit) CART MODE                       */}
        {/* ══════════════════════════════════════════════ */}
        {mode === "credit" && (
          <>
            {/* Add Items toolbar */}
            <div className="flex gap-2">
              <button onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition shrink-0">
                <Scan className="w-4 h-4" /> Scan
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products to add..."
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductSearch(true); }}
                  onFocus={() => setShowProductSearch(true)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {showProductSearch && productSearch && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-card border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    {filteredProducts.length === 0
                      ? <div className="p-4 text-center">
                          <Package className="w-7 h-7 mx-auto mb-1 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No products found</p>
                          <button onClick={() => navigate("/products")} className="mt-2 text-xs text-primary hover:underline">
                            Add from Products page →
                          </button>
                        </div>
                      : filteredProducts.slice(0, 10).map(p => (
                          <button key={p.id} onMouseDown={() => addToCart(p)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left transition">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                              {p.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-card-foreground truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(p.price)}/{p.unit} · {p.stock} in stock
                              </p>
                            </div>
                            <Plus className="w-4 h-4 text-primary shrink-0" />
                          </button>
                        ))
                    }
                  </div>
                )}
              </div>
              {showProductSearch && (
                <button onClick={() => { setShowProductSearch(false); setProductSearch(""); }}
                  className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Cart */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-semibold text-sm text-card-foreground">
                    Cart · {cart.length} item{cart.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:text-destructive transition flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>

              {cart.length === 0
                ? <div className="py-10 text-center">
                    <ShoppingCart className="w-9 h-9 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">Cart is empty</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Scan a barcode or search for products above</p>
                  </div>
                : <>
                    <div className="divide-y divide-border">
                      {cart.map(item => (
                        <div key={item.product.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                            {item.product.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-card-foreground truncate">{item.product.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground">{currency}</span>
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={e => updatePrice(item.product.id, Number(e.target.value))}
                                className="w-20 text-xs font-mono text-card-foreground bg-transparent border-b border-dashed border-border focus:outline-none focus:border-primary"
                              />
                              <span className="text-xs text-muted-foreground">/{item.product.unit}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => updateQty(item.product.id, -1)}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-card-foreground">{item.qty}</span>
                            <button onClick={() => updateQty(item.product.id, 1)}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="w-20 text-right shrink-0">
                            <p className="text-sm font-semibold font-mono text-card-foreground">
                              {formatCurrency(item.qty * item.unitPrice)}
                            </p>
                          </div>
                          <button onClick={() => removeItem(item.product.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border">
                      <span className="font-display font-bold text-sm text-card-foreground">Total Udhar</span>
                      <span className="font-display font-bold text-lg text-destructive font-mono">{formatCurrency(cartTotal)}</span>
                    </div>
                  </>
              }
            </div>

            {/* Credit limit warning */}
            {creditWarning && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-warning/10 text-warning text-sm border border-warning/20">
                <AlertCircle className="w-4 h-4 shrink-0" /> {creditWarning}
              </div>
            )}

            {/* Note + Date */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note (optional)</label>
                <input type="text" placeholder="e.g. Ration, Grocery, Medicine..."
                  value={udharNote} onChange={e => setUdharNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Submit */}
            <button onClick={handleSaveUdhar}
              disabled={submitting || !customerId || cart.length === 0}
              className="w-full py-3.5 rounded-xl text-sm font-bold bg-destructive text-destructive-foreground hover:opacity-90 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Saving..." : `Record Udhar${cartTotal > 0 ? ` · ${formatCurrency(cartTotal)}` : ""}`}
            </button>
          </>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* PAYMENT MODE                                    */}
        {/* ══════════════════════════════════════════════ */}
        {mode === "payment" && (
          <form onSubmit={handleSavePayment} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amount (Rs.) *</label>
              <input type="number" step="1" min="1" placeholder="0"
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground text-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optional)</label>
              <input type="text" placeholder="e.g. Partial payment, Cash..."
                value={payDescription} onChange={e => setPayDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button type="submit"
              disabled={submitting || !customerId}
              className="w-full py-3.5 rounded-xl text-sm font-bold bg-success text-success-foreground hover:opacity-90 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Saving..." : "Record Payment (Wapsi)"}
            </button>
          </form>
        )}

        {/* View ledger shortcut */}
        {customerId && (
          <button onClick={() => navigate(`/customers/${customerId}`)}
            className="w-full py-2 text-sm text-primary hover:underline text-center">
            View {selectedCustomer?.name || "Customer"} Ledger →
          </button>
        )}
      </div>
    </>
  );
}
