import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scan,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  UserCircle,
  ShoppingCart,
  Check,
  X,
  RefreshCw,
  ChevronDown,
  Tag,
} from "lucide-react";
import {
  getProducts,
  getCustomers,
  addTransaction,
  updateProductStock,
  initSettings,
} from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Product, Customer, Settings } from "@/types";

interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
}

// ── Receipt component (reused for print + preview) ───────────────────────────
function ReceiptDoc({
  shopName,
  shopPhone,
  shopAddress,
  receiptFooter,
  cart,
  subtotal,
  discountAmount,
  taxRatePct,
  taxAmount,
  grandTotal,
  cash,
  change,
  saleMode,
  selectedCustomer,
  receiptNo,
  now,
  width,
}: {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  receiptFooter: string;
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxRatePct: number;
  taxAmount: number;
  grandTotal: number;
  cash: number;
  change: number;
  saleMode: "cash" | "credit";
  selectedCustomer: Customer | null;
  receiptNo: string;
  now: Date;
  width: "58mm" | "80mm";
}) {
  const maxW = width === "80mm" ? "80mm" : "58mm";
  const fontSize = width === "80mm" ? "12px" : "11px";

  const dateStr = now.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize,
        maxWidth: maxW,
        margin: "0 auto",
        padding: "4mm 3mm",
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div
          style={{
            fontSize: width === "80mm" ? "17px" : "15px",
            fontWeight: "bold",
            letterSpacing: "0.5px",
          }}
        >
          {shopName}
        </div>
        {shopAddress && (
          <div style={{ fontSize: "9px", marginTop: "2px", color: "#444" }}>
            {shopAddress}
          </div>
        )}
        {shopPhone && <div style={{ fontSize: "9px" }}>📞 {shopPhone}</div>}
      </div>

      <div style={{ borderTop: "1px solid #000", margin: "5px 0" }} />

      {/* ── Meta ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "9px",
          marginBottom: "3px",
        }}
      >
        <span>
          {dateStr} {timeStr}
        </span>
        <span>{receiptNo}</span>
      </div>

      {/* ── Customer ── */}
      {selectedCustomer && (
        <div
          style={{
            fontSize: "10px",
            marginBottom: "4px",
            padding: "3px 0",
            borderBottom: "1px dashed #aaa",
          }}
        >
          <strong>Customer:</strong> {selectedCustomer.name}
          {selectedCustomer.phone && <span> {selectedCustomer.phone}</span>}
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

      {/* ── Items ── */}
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                paddingBottom: "3px",
                fontWeight: "bold",
              }}
            >
              Item
            </th>
            <th
              style={{
                textAlign: "center",
                paddingBottom: "3px",
                fontWeight: "bold",
                whiteSpace: "nowrap",
              }}
            >
              Qty
            </th>
            <th
              style={{
                textAlign: "right",
                paddingBottom: "3px",
                fontWeight: "bold",
                whiteSpace: "nowrap",
              }}
            >
              Rate
            </th>
            <th
              style={{
                textAlign: "right",
                paddingBottom: "3px",
                fontWeight: "bold",
                whiteSpace: "nowrap",
              }}
            >
              Amt
            </th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item) => (
            <tr key={item.product.id}>
              <td
                style={{
                  paddingBottom: "2px",
                  wordBreak: "break-word",
                  maxWidth: "90px",
                }}
              >
                {item.product.name}
                {item.product.sku && (
                  <div style={{ fontSize: "8px", color: "#666" }}>
                    {item.product.sku}
                  </div>
                )}
              </td>
              <td style={{ textAlign: "center", paddingBottom: "2px" }}>
                {item.qty}
              </td>
              <td
                style={{
                  textAlign: "right",
                  paddingBottom: "2px",
                  whiteSpace: "nowrap",
                }}
              >
                {item.unitPrice.toLocaleString()}
              </td>
              <td
                style={{
                  textAlign: "right",
                  paddingBottom: "2px",
                  whiteSpace: "nowrap",
                }}
              >
                {(item.qty * item.unitPrice).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

      {/* ── Totals ── */}
      <div style={{ fontSize: "10px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "2px",
          }}
        >
          <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
          <span>Rs. {subtotal.toLocaleString()}</span>
        </div>
        {discountAmount > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span>Discount</span>
            <span>- Rs. {discountAmount.toLocaleString()}</span>
          </div>
        )}
        {taxRatePct > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span>Tax ({taxRatePct}%)</span>
            <span>
              Rs.{" "}
              {taxAmount.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "bold",
          fontSize: "13px",
        }}
      >
        <span>TOTAL</span>
        <span>
          Rs.{" "}
          {grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* ── Payment ── */}
      {saleMode === "cash" && cash > 0 && (
        <div style={{ fontSize: "10px", marginTop: "3px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Cash Received</span>
            <span>Rs. {cash.toLocaleString()}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
            }}
          >
            <span>Change</span>
            <span>Rs. {Math.max(0, change).toLocaleString()}</span>
          </div>
        </div>
      )}

      {saleMode === "credit" && (
        <div
          style={{
            textAlign: "center",
            marginTop: "6px",
            padding: "4px",
            border: "1px dashed #000",
            fontSize: "11px",
            fontWeight: "bold",
            letterSpacing: "1px",
          }}
        >
          ★ UDHAR / CREDIT ★
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {/* ── Footer ── */}
      <div style={{ textAlign: "center", fontSize: "9px" }}>
        <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
          {receiptFooter}
        </div>
        <div style={{ color: "#666", marginTop: "3px" }}>
          Powered by Bahi — Digital Khata
        </div>
      </div>
    </div>
  );
}

// ── Main POS Page ─────────────────────────────────────────────────────────────
export default function SaleReceipt() {
  const { t, shopType, printerWidth } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [discountInput, setDiscountInput] = useState(""); // new: flat discount
  const [saleMode, setSaleMode] = useState<"cash" | "credit">("cash");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [saleReceiptNo, setSaleReceiptNo] = useState("");
  const [saleTime, setSaleTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getProducts(), getCustomers(), initSettings()]).then(
      ([p, c, s]) => {
        setProducts(p.filter((x) => x.isActive));
        setCustomers(c.filter((x) => x.isActive));
        setSettings(s);
      },
    );
  }, []);

  // ── Calculations ──────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discountAmount = Math.min(parseFloat(discountInput) || 0, subtotal);
  const taxRatePct = settings?.taxRate ?? 0;
  const taxBase = subtotal - discountAmount;
  const taxAmount = taxRatePct > 0 ? taxBase * (taxRatePct / 100) : 0;
  const grandTotal = taxBase + taxAmount;
  const cash = parseFloat(cashReceived) || 0;
  const change = cash - grandTotal;

  // ── Cart actions ──────────────────────────────────────────────────────────
  function addToCart(product: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], qty: u[idx].qty + 1 };
        return u;
      }
      return [...prev, { product, qty: 1, unitPrice: product.price }];
    });
    setSearch("");
    setShowSearch(false);
  }

  function handleBarcodeScan(code: string) {
    const p = products.find(
      (p) =>
        p.sku?.toLowerCase() === code.toLowerCase() ||
        p.name.toLowerCase() === code.toLowerCase(),
    );
    if (p) {
      addToCart(p);
      toast.success(`Added: ${p.name}`);
    } else
      toast.error(
        `No product for barcode "${code}". Add it from Products page.`,
      );
    setShowScanner(false);
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
        )
        .filter((i) => i.qty > 0),
    );
  }
  function updatePrice(id: string, price: number) {
    setCart((prev) =>
      prev.map((i) => (i.product.id === id ? { ...i, unitPrice: price } : i)),
    );
  }
  function removeItem(id: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  }

  // ── Save sale ─────────────────────────────────────────────────────────────
  async function handleSave() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (saleMode === "credit" && !selectedCustomer) {
      toast.error("Please select a customer for credit sale");
      return;
    }
    setSaving(true);
    const now = new Date();
    const receiptNo = `RCP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    try {
      const desc = cart.map((i) => `${i.product.name} ×${i.qty}`).join(", ");
      if (saleMode === "credit" && selectedCustomer) {
        await addTransaction({
          customerId: selectedCustomer.id,
          type: "credit",
          amount: grandTotal,
          description: `Sale: ${desc}`,
          date: now.toISOString(),
        });
      } else {
        await addTransaction({
          customerId: selectedCustomer?.id || "",
          type: "sale",
          amount: grandTotal,
          description: `Cash Sale: ${desc}`,
          date: now.toISOString(),
        });
      }
      await Promise.all(
        cart.map((i) => updateProductStock(i.product.id, -i.qty)),
      );
      setSaleReceiptNo(receiptNo);
      setSaleTime(now);
      setSaved(true);
      setReceiptVisible(true);
      toast.success("Sale recorded!");
    } catch {
      toast.error("Failed to save sale");
    } finally {
      setSaving(false);
    }
  }

  function startNewSale() {
    setCart([]);
    setCashReceived("");
    setDiscountInput("");
    setSelectedCustomer(null);
    setSaleMode("cash");
    setSaved(false);
    setReceiptVisible(false);
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())),
  );
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch),
  );

  const shopName = settings?.shopName || "My Shop";
  const shopPhone = settings?.phone || "";
  const shopAddress = settings?.address || "";
  const receiptFooter = settings?.receiptFooter || "Shukriya! Thank you!";
  const now = new Date();
  const receiptNo = `RCP-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // Shared receipt props (for both print and preview)
  const receiptProps = {
    shopName,
    shopPhone,
    shopAddress,
    receiptFooter,
    cart,
    subtotal,
    discountAmount,
    taxRatePct,
    taxAmount,
    grandTotal,
    cash,
    change,
    saleMode,
    selectedCustomer,
  };

  return (
    <>
      {/* ── Print-only receipt (uses printerWidth setting) ── */}
      <div className="receipt-print-area hidden print:block">
        <ReceiptDoc
          {...receiptProps}
          receiptNo={saleReceiptNo || receiptNo}
          now={saleTime || now}
          width={printerWidth || "58mm"}
        />
      </div>

      {/* ── Main UI ── */}
      <div className="space-y-4 animate-fade-in print:hidden">
        {/* Success + Receipt Preview Modal */}
        <AnimatePresence>
          {receiptVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.92, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col"
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-card-foreground text-sm">
                        Sale Saved!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(grandTotal)} · {saleReceiptNo}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setReceiptVisible(false)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Receipt Preview */}
                <div className="overflow-y-auto flex-1 bg-white">
                  <ReceiptDoc
                    {...receiptProps}
                    receiptNo={saleReceiptNo}
                    now={saleTime}
                    width={printerWidth || "58mm"}
                  />
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-border flex gap-2 shrink-0">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition"
                  >
                    <Printer className="w-4 h-4" /> Print Receipt
                  </button>
                  <button
                    onClick={startNewSale}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-success text-success-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition"
                  >
                    <RefreshCw className="w-4 h-4" /> New Sale
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {showScanner && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Customer Picker Modal */}
        {showCustomerPicker && (
          <div
            className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowCustomerPicker(false)}
          >
            <div
              className="bg-card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display font-semibold text-card-foreground">
                  Select Customer
                </h3>
                <button
                  onClick={() => setShowCustomerPicker(false)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 border-b border-border">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No customers found
                  </p>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setShowCustomerPicker(false);
                        setCustomerSearch("");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left transition"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground">
                          {c.name}
                        </p>
                        {c.phone && (
                          <p className="text-xs text-muted-foreground">
                            {c.phone}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-foreground">
              {t("nav_pos")}
            </h1>
            <p className="text-sm text-muted-foreground">
              Scan · Add items · Print receipt
            </p>
          </div>
          {cart.length > 0 && (
            <button
              onClick={startNewSale}
              className="text-xs text-muted-foreground hover:text-destructive transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Add items toolbar */}
        <div className="flex gap-2">
          {shopType !== "kiryana" && (
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition shrink-0"
            >
              <Scan className="w-4 h-4" /> {t("scan")}
            </button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSearch(true);
              }}
              onFocus={() => setShowSearch(true)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {showSearch && search && (
              <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No products found
                  </p>
                ) : (
                  filteredProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={() => addToCart(p)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(p.price)}/{p.unit} · {p.stock} in
                          stock
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-primary shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {showSearch && (
            <button
              onClick={() => {
                setShowSearch(false);
                setSearch("");
              }}
              className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition"
            >
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
              <button
                onClick={() => setCart([])}
                className="text-xs text-muted-foreground hover:text-destructive transition"
              >
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart className="w-9 h-9 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                Cart empty — scan or search above
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cart.map((item) => (
                <div key={item.product.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {item.product.name.charAt(0)}
                      </div>
                      <p className="text-sm font-semibold text-card-foreground truncate">
                        {item.product.name}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    <span className="text-xs text-muted-foreground">Rs.</span>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updatePrice(item.product.id, Number(e.target.value))
                      }
                      className="w-16 text-xs font-mono text-card-foreground bg-transparent border-b border-dashed border-border focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground flex-1">
                      /{item.product.unit}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, -1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition shrink-0"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-card-foreground shrink-0">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, 1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="w-16 text-right text-sm font-bold font-mono text-card-foreground shrink-0">
                      {formatCurrency(item.qty * item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="px-4 py-3 bg-muted/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)
                  </span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>

                {/* Discount row */}
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Discount
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-xs text-muted-foreground">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="w-20 text-xs font-mono text-right bg-transparent border-b border-dashed border-border focus:outline-none focus:border-primary text-foreground"
                    />
                  </div>
                </div>

                {taxRatePct > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>After Discount</span>
                      <span className="font-mono">
                        {formatCurrency(taxBase)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tax ({taxRatePct}%)</span>
                      <span className="font-mono">
                        {formatCurrency(taxAmount)}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="font-display font-bold text-sm text-card-foreground">
                    Total
                  </span>
                  <span className="font-display font-bold text-lg text-primary font-mono">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment section */}
        {cart.length > 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-4">
            <h3 className="font-display font-semibold text-sm text-card-foreground">
              Payment
            </h3>

            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setSaleMode("cash")}
                className={`flex-1 py-2.5 text-sm font-medium transition ${saleMode === "cash" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                💵 Cash Sale
              </button>
              <button
                onClick={() => setSaleMode("credit")}
                className={`flex-1 py-2.5 text-sm font-medium transition ${saleMode === "credit" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                📋 Udhar (Credit)
              </button>
            </div>

            {saleMode === "cash" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Cash Received (Rs.)
                </label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={grandTotal.toString()}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {cash > 0 && (
                  <div
                    className={`mt-2 px-3 py-2 rounded-lg flex items-center justify-between text-sm font-semibold ${change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                  >
                    <span>{change >= 0 ? "Change to return" : "Short by"}</span>
                    <span className="font-mono text-lg">
                      {formatCurrency(Math.abs(change))}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    Math.ceil(grandTotal / 100) * 100,
                    Math.ceil(grandTotal / 500) * 500,
                    Math.ceil(grandTotal / 1000) * 1000,
                  ]
                    .filter(
                      (v, i, arr) => arr.indexOf(v) === i && v >= grandTotal,
                    )
                    .slice(0, 4)
                    .map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCashReceived(String(amt))}
                        className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition font-mono"
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {saleMode === "credit"
                  ? "Customer (required)"
                  : "Customer (optional)"}
              </label>
              <button
                onClick={() => setShowCustomerPicker(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-input bg-background text-sm text-left hover:border-ring/50 transition"
              >
                <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                <span
                  className={
                    selectedCustomer
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {selectedCustomer
                    ? selectedCustomer.name
                    : "Select customer..."}
                </span>
                {selectedCustomer ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCustomer(null);
                    }}
                    className="ml-auto p-0.5 hover:text-destructive text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                )}
              </button>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="flex gap-3 pb-24 md:pb-4">
            <button
              onClick={handleSave}
              disabled={
                saving || saved || (saleMode === "credit" && !selectedCustomer)
              }
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saved ? (
                <>
                  <Check className="w-4 h-4" /> Saved!
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Sale ·{" "}
                  {formatCurrency(grandTotal)}
                </>
              )}
            </button>
            {saved && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-3.5 bg-secondary text-secondary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
