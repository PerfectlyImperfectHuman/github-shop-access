import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scan, Search, Plus, Minus, Trash2, Printer, UserCircle,
  ShoppingCart, Check, X, RefreshCw, ChevronDown,
} from "lucide-react";
import { getProducts, getCustomers, addTransaction, updateProductStock, initSettings } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Product, Customer, Settings } from "@/types";

interface CartItem { product: Product; qty: number; unitPrice: number; }

export default function SaleReceipt() {
  const { t, shopType } = useLanguage();
  const [products, setProducts]   = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings]   = useState<Settings | null>(null);
  const [cart, setCart]           = useState<CartItem[]>([]);
  const [search, setSearch]       = useState("");
  const [showSearch, setShowSearch]   = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [saleMode, setSaleMode] = useState<"cash" | "credit">("cash");
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getProducts(), getCustomers(), initSettings()]).then(([p, c, s]) => {
      setProducts(p.filter(x => x.isActive));
      setCustomers(c.filter(x => x.isActive));
      setSettings(s);
    });
  }, []);

  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const cash     = parseFloat(cashReceived) || 0;
  const change   = cash - subtotal;

  function addToCart(product: Product) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], qty: u[idx].qty + 1 }; return u; }
      return [...prev, { product, qty: 1, unitPrice: product.price }];
    });
    setSearch(""); setShowSearch(false);
  }

  function handleBarcodeScan(code: string) {
    const p = products.find(p => p.sku?.toLowerCase() === code.toLowerCase() || p.name.toLowerCase() === code.toLowerCase());
    if (p) { addToCart(p); toast.success(`Added: ${p.name}`); }
    else toast.error(`No product for barcode "${code}". Add it from Products page.`);
    setShowScanner(false);
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }
  function updatePrice(id: string, price: number) {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, unitPrice: price } : i));
  }
  function removeItem(id: string) { setCart(prev => prev.filter(i => i.product.id !== id)); }

  async function handleSave() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (saleMode === "credit" && !selectedCustomer) { toast.error("Please select a customer for credit sale"); return; }
    setSaving(true);
    try {
      const desc = cart.map(i => `${i.product.name} ×${i.qty}`).join(", ");
      if (saleMode === "credit" && selectedCustomer) {
        await addTransaction({ customerId: selectedCustomer.id, type: "credit", amount: subtotal, description: `Sale: ${desc}`, date: new Date().toISOString() });
      } else {
        await addTransaction({ customerId: selectedCustomer?.id || "", type: "sale", amount: subtotal, description: `Cash Sale: ${desc}`, date: new Date().toISOString() });
      }
      await Promise.all(cart.map(i => updateProductStock(i.product.id, -i.qty)));
      setSaved(true); setReceiptVisible(true);
      toast.success("Sale recorded!");
    } catch { toast.error("Failed to save sale"); }
    finally { setSaving(false); }
  }

  function startNewSale() {
    setCart([]); setCashReceived(""); setSelectedCustomer(null);
    setSaleMode("cash"); setSaved(false); setReceiptVisible(false);
  }

  const filteredProducts  = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())));
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch));

  const shopName     = settings?.shopName     || "My Shop";
  const shopPhone    = settings?.phone        || "";
  const receiptFooter = settings?.receiptFooter || "Shukriya! Thank you!";
  const now          = new Date();
  const receiptNo    = `RCP-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  return (
    <>
      {/* Print-only receipt */}
      <div className="receipt-print-area hidden print:block">
        <div className="receipt-58" style={{ fontFamily: "monospace", fontSize: "12px", width: "80mm", margin: "0 auto", padding: "4mm" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold" }}>{shopName}</div>
            {shopPhone && <div>{shopPhone}</div>}
            <div style={{ fontSize: "10px", marginTop: "2px" }}>
              {now.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}{" "}
              {now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ fontSize: "10px" }}>Receipt: {receiptNo}</div>
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {selectedCustomer && (
            <div style={{ marginBottom: "6px", fontSize: "11px" }}>
              Customer: <strong>{selectedCustomer.name}</strong>
              {selectedCustomer.phone && <> | {selectedCustomer.phone}</>}
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead><tr>
              <th style={{ textAlign: "left", paddingBottom: "4px" }}>Item</th>
              <th style={{ textAlign: "center" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr></thead>
            <tbody>
              {cart.map(item => (
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
            <span>TOTAL</span><span>Rs. {subtotal.toLocaleString()}</span>
          </div>
          {saleMode === "cash" && cash > 0 && <>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", fontSize: "11px" }}>
              <span>Cash Received</span><span>Rs. {cash.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px" }}>
              <span>Change</span><span>Rs. {Math.max(0, change).toLocaleString()}</span>
            </div>
          </>}
          {saleMode === "credit" && <div style={{ marginTop: "4px", fontSize: "11px", fontStyle: "italic" }}>* Charged to account (Udhar)</div>}
          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
          <div style={{ textAlign: "center", fontSize: "10px" }}>{receiptFooter}</div>
        </div>
      </div>

      {/* Main UI */}
      <div className="space-y-4 animate-fade-in print:hidden">

        {/* Success overlay */}
        <AnimatePresence>
          {receiptVisible && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }}
                className="bg-card rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <Check className="w-7 h-7 text-success" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-card-foreground">Sale Saved!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Total: <span className="font-semibold text-card-foreground">{formatCurrency(subtotal)}</span>
                    {saleMode === "cash" && cash > 0 && change >= 0 && <> · Change: <span className="font-semibold text-success">{formatCurrency(change)}</span></>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button onClick={startNewSale} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition">
                    <RefreshCw className="w-4 h-4" /> New Sale
                  </button>
                </div>
                <button onClick={() => setReceiptVisible(false)} className="text-xs text-muted-foreground hover:underline">Back to edit</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}

        {showCustomerPicker && (
          <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCustomerPicker(false)}>
            <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display font-semibold text-card-foreground">Select Customer</h3>
                <button onClick={() => setShowCustomerPicker(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-3 border-b border-border">
                <input autoFocus type="text" placeholder="Search..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredCustomers.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No customers found</p>
                  : filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); setCustomerSearch(""); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left transition">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{c.name.charAt(0)}</div>
                      <div><p className="text-sm font-medium text-card-foreground">{c.name}</p>{c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}</div>
                    </button>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-foreground">New Sale</h1>
            <p className="text-sm text-muted-foreground">Scan · Add items · Print receipt</p>
          </div>
          {cart.length > 0 && (
            <button onClick={startNewSale} className="text-xs text-muted-foreground hover:text-destructive transition flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Add items toolbar */}
        <div className="flex gap-2">
          {shopType !== "kiryana" && (
            <button onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition shrink-0">
              <Scan className="w-4 h-4" /> {t("scan")}
            </button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search products..."
              value={search} onChange={e => { setSearch(e.target.value); setShowSearch(true); }} onFocus={() => setShowSearch(true)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {showSearch && search && (
              <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                {filteredProducts.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-4">No products found</p>
                  : filteredProducts.slice(0, 8).map(p => (
                    <button key={p.id} onMouseDown={() => addToCart(p)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left transition">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{p.name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(p.price)}/{p.unit} · {p.stock} in stock</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary shrink-0" />
                    </button>
                  ))
                }
              </div>
            )}
          </div>
          {showSearch && <button onClick={() => { setShowSearch(false); setSearch(""); }} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition"><X className="w-4 h-4" /></button>}
        </div>

        {/* Cart */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              <span className="font-display font-semibold text-sm text-card-foreground">Cart · {cart.length} item{cart.length !== 1 ? "s" : ""}</span>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:text-destructive transition">Clear</button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart className="w-9 h-9 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Cart empty — scan or search above</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cart.map(item => (
                <div key={item.product.id} className="px-4 py-3 space-y-2">
                  {/* Row 1: name + delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {item.product.name.charAt(0)}
                      </div>
                      <p className="text-sm font-semibold text-card-foreground truncate">{item.product.name}</p>
                    </div>
                    <button onClick={() => removeItem(item.product.id)} className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Row 2: price input + qty controls + total */}
                  <div className="flex items-center gap-2 pl-9">
                    <span className="text-xs text-muted-foreground">Rs.</span>
                    <input type="number" value={item.unitPrice} onChange={e => updatePrice(item.product.id, Number(e.target.value))}
                      className="w-16 text-xs font-mono text-card-foreground bg-transparent border-b border-dashed border-border focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground flex-1">/{item.product.unit}</span>
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition shrink-0">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-card-foreground shrink-0">{item.qty}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition shrink-0">
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="w-16 text-right text-sm font-bold font-mono text-card-foreground shrink-0">{formatCurrency(item.qty * item.unitPrice)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <span className="font-display font-bold text-sm text-card-foreground">Total</span>
                <span className="font-display font-bold text-lg text-primary font-mono">{formatCurrency(subtotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment section */}
        {cart.length > 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-4">
            <h3 className="font-display font-semibold text-sm text-card-foreground">Payment</h3>

            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setSaleMode("cash")}
                className={`flex-1 py-2.5 text-sm font-medium transition ${saleMode === "cash" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                💵 Cash Sale
              </button>
              <button onClick={() => setSaleMode("credit")}
                className={`flex-1 py-2.5 text-sm font-medium transition ${saleMode === "credit" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                📋 Udhar (Credit)
              </button>
            </div>

            {saleMode === "cash" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cash Received (Rs.)</label>
                <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder={subtotal.toString()}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {cash > 0 && (
                  <div className={`mt-2 px-3 py-2 rounded-lg flex items-center justify-between text-sm font-semibold ${change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    <span>{change >= 0 ? "Change to return" : "Short by"}</span>
                    <span className="font-mono text-lg">{formatCurrency(Math.abs(change))}</span>
                  </div>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[Math.ceil(subtotal / 100) * 100, Math.ceil(subtotal / 500) * 500, Math.ceil(subtotal / 1000) * 1000]
                    .filter((v, i, arr) => arr.indexOf(v) === i && v >= subtotal).slice(0, 4)
                    .map(amt => (
                      <button key={amt} onClick={() => setCashReceived(String(amt))}
                        className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition font-mono">
                        {amt.toLocaleString()}
                      </button>
                    ))
                  }
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {saleMode === "credit" ? "Customer (required)" : "Customer (optional)"}
              </label>
              <button onClick={() => setShowCustomerPicker(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-input bg-background text-sm text-left hover:border-ring/50 transition">
                <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className={selectedCustomer ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {selectedCustomer ? selectedCustomer.name : "Select customer..."}
                </span>
                {selectedCustomer
                  ? <button onClick={e => { e.stopPropagation(); setSelectedCustomer(null); }} className="ml-auto p-0.5 hover:text-destructive text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                  : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                }
              </button>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="flex gap-3 pb-24 md:pb-4">
            <button onClick={handleSave} disabled={saving || saved || (saleMode === "credit" && !selectedCustomer)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : saved ? <><Check className="w-4 h-4" /> Saved!</>
                : <><Check className="w-4 h-4" /> Save Sale · {formatCurrency(subtotal)}</>
              }
            </button>
            {saved && (
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3.5 bg-secondary text-secondary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition">
                <Printer className="w-4 h-4" /> Print
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
