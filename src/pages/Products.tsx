import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Package, Edit2, Trash2, AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";
import { getProducts, addProduct, updateProduct, deleteProduct } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Product } from "@/types";

const CATEGORIES = ["General", "Grocery", "Electronics", "Clothing", "Hardware", "Medicine", "Stationery", "Other"];
const UNITS = ["pcs", "kg", "g", "litre", "ml", "pack", "box", "dozen", "meter"];

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({
    name: "", category: "General", sku: "", price: 0, costPrice: 0, stock: 0, unit: "pcs", minStock: 5,
  });
  const [loading, setLoading] = useState(true);

  async function load() {
    const all = await getProducts();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setProducts(all);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

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
    resetForm();
    load();
  }

  function resetForm() {
    setForm({ name: "", category: "General", sku: "", price: 0, costPrice: 0, stock: 0, unit: "pcs", minStock: 5 });
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(p: Product) {
    setForm({
      name: p.name, category: p.category, sku: p.sku, price: p.price, costPrice: p.costPrice,
      stock: p.stock, unit: p.unit, minStock: p.minStock,
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  async function toggleActive(p: Product) {
    await updateProduct(p.id, { isActive: !p.isActive });
    toast.success(p.isActive ? "Product deactivated" : "Product activated");
    load();
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await deleteProduct(p.id);
    toast.success("Product deleted");
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const lowStock = products.filter(p => p.isActive && p.stock <= p.minStock);
  const totalValue = products.filter(p => p.isActive).reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Products</p>
          <p className="text-lg font-display font-bold text-card-foreground">{products.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-display font-bold text-success">{products.filter(p => p.isActive).length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Low Stock</p>
          <p className="text-lg font-display font-bold text-warning">{lowStock.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Inventory Value</p>
          <p className="text-lg font-display font-bold text-primary">{formatCurrency(totalValue)}</p>
        </div>
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
              <span key={p.id} className="text-xs bg-warning/20 text-warning px-2 py-1 rounded-lg font-medium">
                {p.name}: {p.stock} {p.unit} left
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search products or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-2">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm(); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-card rounded-xl border border-border p-5 shadow-sm" onSubmit={handleSubmit}>
          <h3 className="font-display font-semibold mb-4 text-card-foreground">{editingId ? "Edit Product" : "New Product"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU</label>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU code" className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selling Price (Rs.)</label>
              <input type="number" value={form.price || ""} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Price (Rs.)</label>
              <input type="number" value={form.costPrice || ""} onChange={e => setForm(f => ({ ...f, costPrice: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Stock</label>
              <input type="number" value={form.stock || ""} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Stock Alert</label>
              <input type="number" value={form.minStock || ""} onChange={e => setForm(f => ({ ...f, minStock: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          {form.price > 0 && form.costPrice > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Profit Margin: <span className="text-primary font-semibold">{formatCurrency(form.price - form.costPrice)}</span> per {form.unit} ({((form.price - form.costPrice) / form.costPrice * 100).toFixed(1)}%)
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">{editingId ? "Update" : "Add Product"}</button>
            <button type="button" onClick={resetForm} className="px-5 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">Cancel</button>
          </div>
        </motion.form>
      )}

      {/* Product List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm text-card-foreground">{filtered.length} Product{filtered.length !== 1 ? "s" : ""}</h3>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No products found. Add your first product to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(p => {
              const isLowStock = p.isActive && p.stock <= p.minStock;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 lg:px-5 py-3 ${!p.isActive ? "opacity-50" : ""}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${isLowStock ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-card-foreground truncate">{p.name}</p>
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{p.category}</span>
                      {isLowStock && <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Low</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
                      {p.sku && <span>SKU: {p.sku}</span>}
                      <span>{p.stock} {p.unit}</span>
                      <span className="font-mono">{formatCurrency(p.price)}/{p.unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
                      {p.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
