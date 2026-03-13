import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Phone, MapPin, Edit2, ToggleLeft, ToggleRight, ChevronRight, Trash2, AlertCircle } from "lucide-react";
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, getCustomerBalance } from "@/lib/db";
import { formatCurrency, daysAgo } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Customer } from "@/types";

interface CustomerWithBalance extends Customer {
  balance: number;
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", cnic: "", email: "", creditLimit: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "overdue">("all");
  const navigate = useNavigate();

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

  const filtered = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.cnic?.includes(search);
    if (!matchesSearch) return false;
    if (filterStatus === "active") return c.isActive;
    if (filterStatus === "inactive") return !c.isActive;
    if (filterStatus === "overdue") return c.balance > 0 && c.creditLimit > 0 && c.balance > c.creditLimit;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Customer name is required"); return; }

    if (editingId) {
      await updateCustomer(editingId, { ...form, creditLimit: Number(form.creditLimit) || 0 });
      toast.success("Customer updated");
    } else {
      await addCustomer({ ...form, isActive: true, creditLimit: Number(form.creditLimit) || 0 });
      toast.success("Customer added");
    }
    setForm({ name: "", phone: "", address: "", notes: "", cnic: "", email: "", creditLimit: 0 });
    setShowForm(false);
    setEditingId(null);
    load();
  }

  function startEdit(c: Customer) {
    setForm({ name: c.name, phone: c.phone, address: c.address, notes: c.notes, cnic: c.cnic || "", email: c.email || "", creditLimit: c.creditLimit || 0 });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function toggleActive(c: Customer) {
    await updateCustomer(c.id, { isActive: !c.isActive });
    toast.success(c.isActive ? "Customer deactivated" : "Customer activated");
    load();
  }

  async function handleDelete(c: CustomerWithBalance) {
    if (!confirm(`Delete "${c.name}" and all their transactions? This cannot be undone.`)) return;
    await deleteCustomer(c.id);
    toast.success("Customer deleted");
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalOutstanding = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-display font-bold text-card-foreground">{customers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-display font-bold text-success">{customers.filter(c => c.isActive).length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">With Balance</p>
          <p className="text-lg font-display font-bold text-warning">{customers.filter(c => c.balance > 0).length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-lg font-display font-bold text-destructive">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, or CNIC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className="px-3 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="overdue">Over Limit</option>
          </select>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", phone: "", address: "", notes: "", cnic: "", email: "", creditLimit: 0 }); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-card rounded-xl border border-border p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <h3 className="font-display font-semibold mb-4 text-card-foreground">{editingId ? "Edit Customer" : "New Customer"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <input placeholder="Customer name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
              <input placeholder="03XX-XXXXXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNIC</label>
              <input placeholder="XXXXX-XXXXXXX-X" value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Address</label>
              <input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Credit Limit (Rs.)</label>
              <input type="number" placeholder="0 = unlimited" value={form.creditLimit || ""} onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <input placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
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
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm text-card-foreground">{filtered.length} Customer{filtered.length !== 1 ? "s" : ""}</h3>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No customers found.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(c => {
              const overLimit = c.creditLimit > 0 && c.balance > c.creditLimit;
              return (
                <div key={c.id} className={`flex items-center gap-3 px-4 lg:px-5 py-3 hover:bg-muted/30 transition-colors ${!c.isActive ? "opacity-50" : ""}`}>
                  {/* Click to open ledger */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-card-foreground truncate">{c.name}</p>
                      {!c.isActive && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>}
                      {overLimit && (
                        <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <AlertCircle className="w-3 h-3" /> Over Limit
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      {c.address && <span className="flex items-center gap-1 hidden sm:flex"><MapPin className="w-3 h-3" />{c.address}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-1">
                      <p className={`text-sm font-mono font-semibold ${c.balance > 0 ? "text-destructive" : c.balance < 0 ? "text-success" : "text-muted-foreground"}`}>
                        {c.balance > 0 ? `${formatCurrency(c.balance)}` : c.balance < 0 ? `${formatCurrency(c.balance)} adv` : "Settled"}
                      </p>
                      {c.creditLimit > 0 && (
                        <p className="text-[10px] text-muted-foreground">Limit: {formatCurrency(c.creditLimit)}</p>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(c); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleActive(c); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
                      {c.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(c); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)} />
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
