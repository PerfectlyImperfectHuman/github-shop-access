import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Package, Edit2, Trash2, AlertTriangle, ToggleLeft, ToggleRight, X, Scan } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addProduct, updateProduct, deleteProduct } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Product } from "@/types";

const CATEGORIES = ["General", "Grocery", "Electronics", "Clothing", "Hardware", "Medicine", "Stationery", "Other"];
const UNITS = ["pcs", "kg", "g", "litre", "ml", "pack", "box", "dozen", "meter"];

const CATEGORY_OPTIONS = CATEGORIES.map(c => ({ value: c, label: c }));
const UNIT_OPTIONS = UNITS.map(u => ({ value: u, label: u }));

const emptyForm = { name: "", category: "General", sku: "", price: 0, costPrice: 0, stock: 0, unit: "pcs", minStock: 5 };

export default function Products() {
  const { t } = useLanguage();
  const productsRaw = useLiveQuery(() => db.products.toArray(), []);
  const products = useMemo(() => {
    const all = [...(productsRaw ?? [])];
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all;
  }, [productsRaw]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState(emptyForm);
  const loading = productsRaw === undefined;
  const [showScanner, setShowScanner] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (editingId) {
      await updateProduct(editingId, form);
      toast.success("Product updated");
    } else {
      await addProduct({ ...form, isActive: true });
      toast.success("Product added");
    }
    closeForm();
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openNewForm(preFillSku?: string) {
    setForm({ ...emptyForm, sku: preFillSku || "" });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setForm({ name: p.name, category: p.category, sku: p.sku, price: p.price, costPrice: p.costPrice, stock: p.stock, unit: p.unit, minStock: p.minStock });
    setEditingId(p.id);
    setShowForm(true);
  }

  async function toggleActive(p: Product) {
    await updateProduct(p.id, { isActive: !p.isActive });
    toast.success(p.isActive ? "Product deactivated" : "Product activated");
  }

  async function confirmDeleteProduct() {
    if (!deleteTarget) return;
    await deleteProduct(deleteTarget.id);
    toast.success("Product deleted");
    setDeleteTarget(null);
  }

  // Barcode scan on the Products page:
  // - If product with that SKU exists → open its edit form
  // - If not found → open new product form with SKU pre-filled
  function handleBarcodeScan(code: string) {
    setShowScanner(false);
    const existing = products.find(p =>
      p.sku?.toLowerCase() === code.toLowerCase()
    );
    if (existing) {
      startEdit(existing);
      toast.success(`Product found: ${existing.name}`);
    } else {
      openNewForm(code);
      toast.info(`New barcode "${code}" — fill in the product details`);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const lowStock = products.filter(p => p.isActive && p.stock <= p.minStock);
  const totalValue = products.filter(p => p.isActive).reduce((s, p) => s + p.price * p.stock, 0);
  const filterCategoryOptions = [{ value: "", label: t("category") }, ...CATEGORY_OPTIONS];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("nav_products"), value: products.length, color: "text-card-foreground" },
          { label: t("active"), value: products.filter(p => p.isActive).length, color: "text-success" },
          { label: t("low_stock"), value: lowStock.length, color: "text-warning" },
          { label: t("total"), value: formatCurrency(totalValue), color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-display font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-warning/10 rounded-xl p-4 border border-warning/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h4 className="text-sm font-semibold text-warning">Low Stock Alert</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(p => (
              <button key={p.id} onClick={() => startEdit(p)} className="text-xs bg-warning/20 text-warning px-2.5 py-1 rounded-lg font-medium hover:bg-warning/30 transition">
                {p.name}: {p.stock} {p.unit} left
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search products or SKU..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-44">
            <SelectField value={filterCategory} onValueChange={setFilterCategory} options={filterCategoryOptions} placeholder="All Categories" />
          </div>
          {/* Scan Barcode button — looks up by SKU, adds new if not found */}
          <button onClick={() => setShowScanner(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition whitespace-nowrap shrink-0"
            title="Scan barcode to find or add product">
            <Scan className="w-4 h-4" />
            <span className="hidden sm:inline">Scan</span>
          </button>
          <button onClick={() => openNewForm()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> {t("add_product")}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-card-foreground">
              {editingId ? "Edit Product" : "New Product"}
              {form.sku && !editingId && <span className="ml-2 text-xs text-muted-foreground font-normal">SKU: {form.sku}</span>}
            </h3>
            <button type="button" onClick={closeForm} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" autoFocus
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <SelectField value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORY_OPTIONS} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU / Barcode</label>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Optional — scan or type"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selling Price (Rs.)</label>
              <input type="number" value={form.price || ""} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} placeholder="0"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Price (Rs.)</label>
              <input type="number" value={form.costPrice || ""} onChange={e => setForm(f => ({ ...f, costPrice: Number(e.target.value) }))} placeholder="0"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Stock</label>
              <input type="number" value={form.stock || ""} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))} placeholder="0"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit</label>
              <SelectField value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))} options={UNIT_OPTIONS} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Low Stock Alert (min)</label>
              <input type="number" value={form.minStock || ""} onChange={e => setForm(f => ({ ...f, minStock: Number(e.target.value) }))} placeholder="5"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          {form.price > 0 && form.costPrice > 0 && (
            <div className="mt-3 px-3 py-2 bg-primary/10 rounded-lg">
              <p className="text-xs text-primary">
                Profit: <span className="font-semibold">{formatCurrency(form.price - form.costPrice)}</span> per {form.unit}
                <span className="ml-2 text-muted-foreground">({((form.price - form.costPrice) / form.costPrice * 100).toFixed(1)}%)</span>
              </p>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              {editingId ? "Update Product" : "Add Product"}
            </button>
            <button type="button" onClick={closeForm} className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {/* Product List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-card-foreground">{filtered.length} Product{filtered.length !== 1 ? "s" : ""}</h3>
          {filtered.length !== products.length && (
            <button onClick={() => { setSearch(""); setFilterCategory(""); }} className="text-xs text-primary hover:underline">Clear filters</button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              {products.length === 0 ? "No products yet" : "No products match your search"}
            </p>
            {products.length === 0 && (
              <div className="mt-4 flex gap-2 justify-center">
                <button onClick={() => openNewForm()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
                  Add First Product
                </button>
                <button onClick={() => setShowScanner(true)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5">
                  <Scan className="w-3.5 h-3.5" /> Scan Barcode
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(p => {
              const isLowStock = p.isActive && p.stock <= p.minStock;
              const profitMargin = p.price > 0 && p.costPrice > 0 ? ((p.price - p.costPrice) / p.costPrice * 100).toFixed(0) : null;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-muted/20 transition-colors ${!p.isActive ? "opacity-50" : ""}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${isLowStock ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-card-foreground truncate">{p.name}</p>
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">{p.category}</span>
                      {isLowStock && <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0"><AlertTriangle className="w-3 h-3" /> Low</span>}
                      {!p.isActive && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono font-medium text-card-foreground">{formatCurrency(p.price)}/{p.unit}</span>
                      <span>{p.stock} {p.unit}</span>
                      {p.sku && <span className="font-mono">#{p.sku}</span>}
                      {profitMargin && <span className="text-primary">{profitMargin}% margin</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition" title={p.isActive ? "Deactivate" : "Activate"}>
                      {p.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={o => { if (!o) setDeleteTarget(null); }}
        title={t("delete")}
        description={deleteTarget ? `Delete "${deleteTarget.name}"? This cannot be undone.` : ""}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDeleteProduct}
      />
    </div>
  );
}
