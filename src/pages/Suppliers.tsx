import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Phone, Edit2, Trash2, ChevronRight, X, Truck } from "lucide-react";
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier, getSupplierBalance } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";
import type { Supplier } from "@/types";

interface SupplierWithBalance extends Supplier { balance: number; }

const emptyForm = { name: "", phone: "", address: "", notes: "", openingBalance: 0 };

export default function Suppliers() {
  const t = useT();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  async function load() {
    const all = await getSuppliers();
    const withBal = await Promise.all(all.map(async s => ({ ...s, balance: await getSupplierBalance(s.id) })));
    setSuppliers(withBal);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.phone.includes(search);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error(t("required")); return; }
    if (editingId) {
      await updateSupplier(editingId, { ...form, openingBalance: Number(form.openingBalance) || 0 });
      toast.success(t("supplier_updated"));
    } else {
      await addSupplier({ ...form, isActive: true, openingBalance: Number(form.openingBalance) || 0 });
      toast.success(t("supplier_added"));
    }
    closeForm();
    load();
  }

  function closeForm() { setShowForm(false); setEditingId(null); setForm(emptyForm); }
  function openNewForm() { setForm(emptyForm); setEditingId(null); setShowForm(true); }
  function startEdit(s: Supplier) {
    setForm({ name: s.name, phone: s.phone, address: s.address, notes: s.notes, openingBalance: s.openingBalance || 0 });
    setEditingId(s.id);
    setShowForm(true);
  }

  async function handleDelete(s: SupplierWithBalance) {
    if (!confirm(t("delete_supplier_confirm"))) return;
    await deleteSupplier(s.id);
    toast.success(t("supplier_deleted"));
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalToPay = suppliers.reduce((s, sup) => s + Math.max(0, sup.balance), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">{t("total_suppliers")}</p>
          <p className="text-lg font-display font-bold text-card-foreground">{suppliers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">{t("to_pay")}</p>
          <p className="text-lg font-display font-bold text-warning">{formatCurrency(totalToPay)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder={t("search_supplier_placeholder")} value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition whitespace-nowrap">
          <Plus className="w-4 h-4" /> {t("add")}
        </button>
      </div>

      {showForm && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-5 shadow-sm" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-card-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              {editingId ? t("edit_supplier") : t("new_supplier")}
            </h3>
            <button type="button" onClick={closeForm} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("supplier_name")} *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("phone")}</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="03XX-XXXXXXX"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("address")}</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("opening_balance")}</label>
              <input type="number" value={form.openingBalance || ""} onChange={e => setForm(f => ({ ...f, openingBalance: Number(e.target.value) }))} placeholder="0"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
              <p className="text-[10px] text-muted-foreground mt-1">{t("opening_balance_hint")}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("notes")}</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              {t("save")}
            </button>
            <button type="button" onClick={closeForm} className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              {t("cancel")}
            </button>
          </div>
        </motion.form>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">{t("no_suppliers_yet")}</p>
            {suppliers.length === 0 && (
              <button onClick={openNewForm} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
                {t("add_first_supplier")}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div onClick={() => navigate(`/suppliers/${s.id}`)}
                  className="w-9 h-9 rounded-full bg-warning/10 flex items-center justify-center text-sm font-bold text-warning shrink-0 cursor-pointer">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/suppliers/${s.id}`)}>
                  <p className="text-sm font-semibold text-card-foreground truncate">{s.name}</p>
                  {s.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{s.phone}</p>}
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className={`text-sm font-mono font-semibold ${s.balance > 0 ? "text-warning" : s.balance < 0 ? "text-success" : "text-muted-foreground"}`}>
                    {s.balance > 0 ? formatCurrency(s.balance) : s.balance < 0 ? `${formatCurrency(Math.abs(s.balance))} adv` : t("settled")}
                  </p>
                  {s.balance > 0 && <p className="text-[10px] text-muted-foreground">{t("to_pay")}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); startEdit(s); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(s); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 cursor-pointer" onClick={() => navigate(`/suppliers/${s.id}`)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
