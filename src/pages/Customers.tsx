import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Phone, MapPin, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { getCustomers, addCustomer, updateCustomer, getCustomerBalance } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Customer } from "@/types";

interface CustomerWithBalance extends Customer {
  balance: number;
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    const all = await getCustomers();
    const withBal = await Promise.all(
      all.map(async c => ({ ...c, balance: await getCustomerBalance(c.id) }))
    );
    withBal.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setCustomers(withBal);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Customer name is required"); return; }

    if (editingId) {
      await updateCustomer(editingId, form);
      toast.success("Customer updated");
    } else {
      await addCustomer({ ...form, isActive: true });
      toast.success("Customer added");
    }
    setForm({ name: "", phone: "", address: "", notes: "" });
    setShowForm(false);
    setEditingId(null);
    load();
  }

  function startEdit(c: Customer) {
    setForm({ name: c.name, phone: c.phone, address: c.address, notes: c.notes });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function toggleActive(c: Customer) {
    await updateCustomer(c.id, { isActive: !c.isActive });
    toast.success(c.isActive ? "Customer deactivated" : "Customer activated");
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", phone: "", address: "", notes: "" }); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <h3 className="font-display font-semibold mb-4 text-card-foreground">{editingId ? "Edit Customer" : "New Customer"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              {editingId ? "Update" : "Add Customer"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-5 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {/* Customer List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-card-foreground">{filtered.length} Customer{filtered.length !== 1 ? "s" : ""}</h3>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No customers found.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(c => (
              <div key={c.id} className={`flex items-center justify-between px-6 py-4 ${!c.isActive ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-card-foreground truncate">{c.name}</p>
                    {!c.isActive && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                    {c.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.address}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right mr-2">
                    <p className={`text-sm font-mono font-semibold ${c.balance > 0 ? "text-destructive" : c.balance < 0 ? "text-success" : "text-muted-foreground"}`}>
                      {c.balance > 0 ? `${formatCurrency(c.balance)} due` : c.balance < 0 ? `${formatCurrency(c.balance)} advance` : "Settled"}
                    </p>
                  </div>
                  <button onClick={() => startEdit(c)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(c)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition">
                    {c.isActive ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
