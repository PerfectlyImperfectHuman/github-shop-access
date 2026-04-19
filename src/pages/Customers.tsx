import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Edit2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Trash2,
  AlertCircle,
  MessageCircle,
  X,
  UserPlus,
  Send,
  Copy,
  Check as CheckIcon,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addCustomer, updateCustomer, deleteCustomer } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Customer } from "@/types";

interface CustomerWithBalance extends Customer {
  balance: number;
}

const emptyForm = {
  name: "",
  phone: "",
  address: "",
  notes: "",
  cnic: "",
  email: "",
  creditLimit: 0,
};

export default function Customers() {
  const { t } = useLanguage();
  const customersRaw = useLiveQuery(() => db.customers.toArray(), []);
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray(), []);
  const customers = useMemo((): CustomerWithBalance[] => {
    const list = customersRaw ?? [];
    const txns = transactionsRaw ?? [];
    const balById: Record<string, number> = {};
    for (const tr of txns) {
      if (!tr.customerId) continue;
      if (tr.type === "credit")
        balById[tr.customerId] = (balById[tr.customerId] ?? 0) + tr.amount;
      else if (tr.type === "payment")
        balById[tr.customerId] = (balById[tr.customerId] ?? 0) - tr.amount;
    }
    return list.map((c) => ({ ...c, balance: balById[c.id] ?? 0 }));
  }, [customersRaw, transactionsRaw]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const loading = customersRaw === undefined || transactionsRaw === undefined;
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [deleteTarget, setDeleteTarget] = useState<CustomerWithBalance | null>(
    null,
  );
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const filterOptions = [
    { value: "all", label: t("filter_all") },
    { value: "active", label: t("filter_active") },
    { value: "inactive", label: t("filter_inactive") },
    { value: "overdue", label: t("filter_overdue") },
    { value: "balance", label: t("filter_with_balance") },
  ];

  const sorted = [...customers].sort((a, b) => {
    if (sortBy === "newest")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === "balance") return b.balance - a.balance;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return 0;
  });

  const filtered = sorted.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(search) ||
      (c.cnic || "").includes(search);
    if (!matchesSearch) return false;
    if (filterStatus === "active") return c.isActive;
    if (filterStatus === "inactive") return !c.isActive;
    if (filterStatus === "overdue")
      return c.creditLimit > 0 && c.balance > c.creditLimit;
    if (filterStatus === "balance") return c.balance > 0;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t("customer_name") + " " + t("required"));
      return;
    }
    if (editingId) {
      await updateCustomer(editingId, {
        ...form,
        creditLimit: Number(form.creditLimit) || 0,
      });
      toast.success(t("customer_updated"));
    } else {
      await addCustomer({
        ...form,
        isActive: true,
        creditLimit: Number(form.creditLimit) || 0,
      });
      toast.success(t("customer_added"));
    }
    closeForm();
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openNewForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(c: Customer) {
    setForm({
      name: c.name,
      phone: c.phone,
      address: c.address,
      notes: c.notes,
      cnic: c.cnic || "",
      email: c.email || "",
      creditLimit: c.creditLimit || 0,
    });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function toggleActive(c: Customer) {
    await updateCustomer(c.id, { isActive: !c.isActive });
    toast.success(c.isActive ? t("customer_updated") : t("customer_updated"));
  }

  async function confirmDeleteCustomer() {
    if (!deleteTarget) return;
    await deleteCustomer(deleteTarget.id);
    toast.success(t("customer_deleted"));
    setDeleteTarget(null);
  }

  function openWhatsApp(c: Customer, balance: number) {
    if (!c.phone) {
      toast.error(t("no_phone_saved"));
      return;
    }
    const digits = c.phone.replace(/\D/g, "");
    const intl = digits.startsWith("0")
      ? "92" + digits.slice(1)
      : digits.startsWith("92")
        ? digits
        : "92" + digits;
    const balMsg =
      balance > 0
        ? `Aapka balance Rs. ${balance.toLocaleString()} hai (baaki hua)`
        : balance < 0
          ? `Aapka advance balance Rs. ${Math.abs(balance).toLocaleString()} hai`
          : "Aapka account settled hai";
    const msg = `Assalam u Alaikum ${c.name}!\n\n${balMsg}.\n\nShukriya!`;
    window.open(
      `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  }

  // Customers with outstanding balance, sorted highest first
  const debtorCustomers = customers
    .filter((c) => c.balance > 0 && c.isActive)
    .sort((a, b) => b.balance - a.balance);

  function toIntlPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("92")) return digits;
    if (digits.startsWith("0")) return "92" + digits.slice(1);
    return "92" + digits;
  }

  function openBulkWhatsApp(c: CustomerWithBalance) {
    if (!c.phone) {
      toast.error(`${c.name} ka phone number nahi hai`);
      return;
    }
    const intl = toIntlPhone(c.phone);
    const msg =
      `Assalam u Alaikum ${c.name}!\n\n` +
      `Aapka baaki balance Rs. ${c.balance.toLocaleString()} hai.\n\n` +
      `Meherbani karke jald payment kar dein.\n\nShukriya! 🙏`;
    window.open(
      `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  }

  async function copyAllBalances() {
    const totalOutstandingBulk = debtorCustomers.reduce(
      (s, c) => s + c.balance,
      0,
    );
    const lines = [
      `📋 Outstanding Balances — ${new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}`,
      ``,
      ...debtorCustomers.map(
        (c, i) =>
          `${i + 1}. ${c.name}${c.phone ? ` (${c.phone})` : ""} — Rs. ${c.balance.toLocaleString()}`,
      ),
      ``,
      `Total: Rs. ${totalOutstandingBulk.toLocaleString()}`,
      `(${debtorCustomers.length} customers)`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("List copied! Paste it anywhere.");
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalOutstanding = customers.reduce(
    (sum, c) => sum + Math.max(0, c.balance),
    0,
  );
  const sortOptions = [
    { value: "newest", label: t("sort_newest") },
    { value: "balance", label: t("sort_balance") },
    { value: "name", label: t("sort_name") },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: t("total_customers"),
            value: customers.length,
            color: "text-card-foreground",
          },
          {
            label: t("active"),
            value: customers.filter((c) => c.isActive).length,
            color: "text-success",
          },
          {
            label: t("with_balance"),
            value: customers.filter((c) => c.balance > 0).length,
            color: "text-warning",
          },
          {
            label: t("outstanding"),
            value: formatCurrency(totalOutstanding),
            color: "text-destructive",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card rounded-xl border border-border p-3 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-display font-bold ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Header + Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("search_customer_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-44 min-w-0">
            <SelectField
              value={filterStatus}
              onValueChange={setFilterStatus}
              options={filterOptions}
            />
          </div>
          <div className="flex-1 sm:w-36 min-w-0">
            <SelectField
              value={sortBy}
              onValueChange={setSortBy}
              options={sortOptions}
            />
          </div>
          {debtorCustomers.length > 0 && (
            <button
              onClick={() => setShowBulkPanel((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap shrink-0 ${
                showBulkPanel
                  ? "bg-green-600 text-white"
                  : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
              }`}
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Remind</span>
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {debtorCustomers.length}
              </span>
            </button>
          )}
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" /> {t("add")}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-card-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              {editingId ? t("edit_customer") : t("new_customer")}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t("customer_name")} *
              </label>
              <input
                placeholder="Customer name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Phone
              </label>
              <input
                placeholder="03XX-XXXXXXX"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                CNIC
              </label>
              <input
                placeholder="XXXXX-XXXXXXX-X"
                value={form.cnic}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cnic: e.target.value }))
                }
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Address
              </label>
              <input
                placeholder="Area / street"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Credit Limit (Rs.){" "}
                <span className="text-muted-foreground/60">
                  — 0 = unlimited
                </span>
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.creditLimit || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    creditLimit: Number(e.target.value),
                  }))
                }
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Notes
              </label>
              <input
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              {editingId ? t("save") : t("add")}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              {t("cancel")}
            </button>
          </div>
        </motion.form>
      )}

      {/* ── Bulk Reminder Panel ─────────────────────────────────────── */}
      {showBulkPanel && debtorCustomers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-green-500/30 shadow-sm overflow-hidden"
        >
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-green-500/5">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-green-600" />
              <h3 className="font-display font-semibold text-sm text-card-foreground">
                Bulk WhatsApp Reminder
              </h3>
              <span className="text-xs text-muted-foreground">
                — {debtorCustomers.length} customers, Rs.{" "}
                {debtorCustomers
                  .reduce((s, c) => s + c.balance, 0)
                  .toLocaleString()}{" "}
                total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyAllBalances}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition"
              >
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5 text-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Copied!" : "Copy List"}
              </button>
              <button
                onClick={() => setShowBulkPanel(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="px-4 py-2 bg-muted/30 border-b border-border">
            <p className="text-xs text-muted-foreground">
              📱 Har customer ko alag personalized message jayega. Tap karo
              WhatsApp icon to send. Ya{" "}
              <span className="font-medium text-foreground">Copy List</span> se
              poori list copy karein.
            </p>
          </div>

          {/* Customer rows */}
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {debtorCustomers.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
              >
                {/* Rank */}
                <span className="w-5 text-xs font-bold text-muted-foreground shrink-0">
                  {i + 1}
                </span>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-card-foreground truncate">
                    {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone || <span className="text-warning">No phone</span>}
                  </p>
                </div>

                {/* Balance */}
                <p className="text-sm font-mono font-bold text-destructive shrink-0">
                  Rs. {c.balance.toLocaleString()}
                </p>

                {/* WhatsApp button */}
                {c.phone ? (
                  <button
                    onClick={() => openBulkWhatsApp(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 shrink-0"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Send
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground/50 shrink-0 w-16 text-center">
                    No phone
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Footer summary */}
          <div className="px-4 py-2.5 bg-muted/20 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {debtorCustomers.filter((c) => c.phone).length} of{" "}
              {debtorCustomers.length} have phone numbers
            </p>
            <p className="text-xs font-semibold text-destructive">
              Total baaki: Rs.{" "}
              {debtorCustomers
                .reduce((s, c) => s + c.balance, 0)
                .toLocaleString()}
            </p>
          </div>
        </motion.div>
      )}

      {/* Customer List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-card-foreground">
            {filtered.length} {t("nav_customers")}
          </h3>
          {(search || filterStatus !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterStatus("all");
              }}
              className="text-xs text-primary hover:underline"
            >
              {t("clear_filters")}
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="font-medium text-muted-foreground">
              {customers.length === 0
                ? t("no_customers_yet")
                : t("no_customers_match")}
            </p>
            {customers.length === 0 && (
              <button
                onClick={openNewForm}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                {t("add_first_customer")}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => {
              const overLimit = c.creditLimit > 0 && c.balance > c.creditLimit;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-muted/20 transition-colors ${!c.isActive ? "opacity-60" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 cursor-pointer"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-card-foreground">
                        {c.name}
                      </p>
                      {!c.isActive && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                      {overLimit && (
                        <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <AlertCircle className="w-3 h-3" /> Over Limit
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {c.address}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p
                      className={`text-sm font-mono font-semibold ${c.balance > 0 ? "text-destructive" : c.balance < 0 ? "text-success" : "text-muted-foreground"}`}
                    >
                      {c.balance > 0
                        ? formatCurrency(c.balance)
                        : c.balance < 0
                          ? `${formatCurrency(Math.abs(c.balance))} adv`
                          : "Settled"}
                    </p>
                    {c.creditLimit > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Limit: {formatCurrency(c.creditLimit)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {c.phone && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(c, c.balance);
                        }}
                        className="p-1.5 rounded-lg hover:bg-green-500/10 text-muted-foreground hover:text-green-600 transition"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(c);
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(c);
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition hidden sm:flex"
                      title={c.isActive ? "Deactivate" : "Activate"}
                    >
                      {c.isActive ? (
                        <ToggleRight className="w-4 h-4 text-success" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight
                      className="w-4 h-4 text-muted-foreground/30 cursor-pointer"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={t("delete")}
        description={deleteTarget ? t("delete_customer_confirm") : ""}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDeleteCustomer}
      />
    </div>
  );
}
