import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Banknote,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  Building2,
  Hash,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  addCheque,
  updateChequeStatus,
  clearCheque,
  deleteCheque,
} from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ChequeStatus, ChequeType } from "@/types";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ChequeStatus,
  { label: string; color: string; bg: string; icon: any }
> = {
  pending: {
    label: "Pending",
    color: "text-warning",
    bg: "bg-warning/10",
    icon: Clock,
  },
  deposited: {
    label: "Deposited",
    color: "text-info",
    bg: "bg-info/10",
    icon: Building2,
  },
  cleared: {
    label: "Cleared",
    color: "text-success",
    bg: "bg-success/10",
    icon: CheckCircle2,
  },
  bounced: {
    label: "Bounced",
    color: "text-destructive",
    bg: "bg-destructive/10",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-muted-foreground",
    bg: "bg-muted",
    icon: Ban,
  },
};

const emptyForm = {
  type: "received" as ChequeType,
  partyName: "",
  partyId: "",
  partyType: "customer" as "customer" | "supplier" | "other",
  amount: "",
  chequeNo: "",
  bankName: "",
  chequeDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function Cheques() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const chequesRaw = useLiveQuery(
    () => db.cheques.orderBy("chequeDate").reverse().toArray(),
    [],
  );
  const customers =
    useLiveQuery(() => db.customers.filter((c) => c.isActive).toArray(), []) ??
    [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];
  const cheques = chequesRaw ?? [];
  const loading = chequesRaw === undefined;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ChequeType>("received");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Filtered ──────────────────────────────────────────────────────────────
  const tabCheques = cheques.filter((c) => c.type === activeTab);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = cheques;
    return {
      pendingReceived: all
        .filter((c) => c.type === "received" && c.status === "pending")
        .reduce((s, c) => s + c.amount, 0),
      pendingIssued: all
        .filter((c) => c.type === "issued" && c.status === "pending")
        .reduce((s, c) => s + c.amount, 0),
      bouncedCount: all.filter((c) => c.status === "bounced").length,
      clearedThisMonth: all
        .filter((c) => {
          if (c.status !== "cleared") return false;
          const d = new Date(c.updatedAt);
          const now = new Date();
          return (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          );
        })
        .reduce((s, c) => s + c.amount, 0),
    };
  }, [cheques]);

  // ── Party options based on form.partyType ─────────────────────────────────
  const partyOptions =
    form.partyType === "customer"
      ? customers
      : form.partyType === "supplier"
        ? suppliers
        : [];

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handlePartyTypeChange(pt: "customer" | "supplier" | "other") {
    setForm((f) => ({ ...f, partyType: pt, partyId: "", partyName: "" }));
  }

  function handlePartySelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const list = form.partyType === "customer" ? customers : suppliers;
    const found = list.find((p) => p.id === id);
    setForm((f) => ({ ...f, partyId: id, partyName: found?.name ?? "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!form.partyName.trim()) {
      toast.error("Party name is required");
      return;
    }
    if (!form.chequeNo.trim()) {
      toast.error("Cheque number is required");
      return;
    }
    if (!form.bankName.trim()) {
      toast.error("Bank name is required");
      return;
    }

    setSubmitting(true);
    try {
      await addCheque({
        type: form.type,
        partyName: form.partyName.trim(),
        partyId: form.partyId || undefined,
        partyType: form.partyType,
        amount: amt,
        chequeNo: form.chequeNo.trim(),
        bankName: form.bankName.trim(),
        chequeDate: new Date(form.chequeDate).toISOString(),
        status: "pending",
        notes: form.notes.trim(),
      });
      toast.success("Cheque recorded ✓");
      setShowForm(false);
      setForm(emptyForm);
    } catch {
      toast.error("Failed to save cheque");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusUpdate(id: string, status: ChequeStatus) {
    if (status === "cleared") {
      try {
        await clearCheque(id);
        toast.success("Cheque cleared — payment transaction created ✓");
      } catch {
        toast.error("Failed to clear cheque");
      }
    } else {
      await updateChequeStatus(id, status);
      toast.success(`Cheque marked as ${status}`);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await deleteCheque(deleteId);
    toast.success("Cheque deleted");
    setDeleteId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "To Receive",
            value: formatCurrency(stats.pendingReceived),
            color: "text-success",
            bg: "bg-success/10",
            icon: Banknote,
          },
          {
            label: "To Pay",
            value: formatCurrency(stats.pendingIssued),
            color: "text-warning",
            bg: "bg-warning/10",
            icon: Banknote,
          },
          {
            label: "Bounced",
            value: `${stats.bouncedCount} cheque${stats.bouncedCount !== 1 ? "s" : ""}`,
            color: "text-destructive",
            bg: "bg-destructive/10",
            icon: AlertCircle,
          },
          {
            label: "Cleared (Mo)",
            value: formatCurrency(stats.clearedThisMonth),
            color: "text-primary",
            bg: "bg-primary/10",
            icon: CheckCircle2,
          },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-card rounded-xl border border-border p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1.5 rounded-lg ${c.bg}`}>
                <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {c.label}
              </p>
            </div>
            <p className={`text-lg font-display font-bold ${c.color}`}>
              {c.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Tab + Add button ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-border overflow-hidden bg-muted/30 p-1 gap-1 flex-1 max-w-xs">
          {(["received", "issued"] as ChequeType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "received" ? "📥 Received" : "📤 Issued"}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setForm({ ...emptyForm, type: activeTab });
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add Cheque"}
        </button>
      </div>

      {/* ── Add Cheque Form ───────────────────────────────────────────── */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4"
        >
          <h3 className="font-display font-semibold text-card-foreground flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" />
            {form.type === "received"
              ? "Record Received Cheque"
              : "Record Issued Cheque"}
          </h3>

          {/* Type toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["received", "issued"] as ChequeType[]).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: tp }))}
                className={`flex-1 py-2 text-sm font-semibold capitalize transition ${
                  form.type === tp
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tp === "received" ? "📥 Received from" : "📤 Issued to"}
              </button>
            ))}
          </div>

          {/* Party type + select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Party Type
              </label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["customer", "supplier", "other"] as const).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => handlePartyTypeChange(pt)}
                    className={`flex-1 py-2 text-xs font-semibold capitalize transition ${
                      form.partyType === pt
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {pt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {form.partyType === "other" ? "Party Name *" : "Select Party *"}
              </label>
              {form.partyType === "other" ? (
                <input
                  value={form.partyName}
                  required
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyName: e.target.value }))
                  }
                  placeholder="Enter name"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <select
                  value={form.partyId}
                  required
                  onChange={handlePartySelect}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select {form.partyType}...</option>
                  {partyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Amount (Rs.) *
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="e.g. 50000"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Cheque Date *
              </label>
              <input
                type="date"
                required
                value={form.chequeDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chequeDate: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Cheque No. *
              </label>
              <input
                placeholder="e.g. 0012345"
                required
                value={form.chequeNo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chequeNo: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Bank Name *
              </label>
              <input
                placeholder="e.g. HBL, UBL, MCB"
                required
                value={form.bankName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bankName: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Notes
              </label>
              <input
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Cheque"}
          </button>
        </motion.form>
      )}

      {/* ── Cheque List ───────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm text-card-foreground">
            {activeTab === "received" ? "Received Cheques" : "Issued Cheques"}
            <span className="text-muted-foreground font-normal ml-1.5">
              ({tabCheques.length})
            </span>
          </h3>
        </div>

        {tabCheques.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Banknote className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">
              No {activeTab} cheques yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeTab === "received"
                ? "Record cheques received from customers"
                : "Track cheques you've issued to suppliers"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tabCheques.map((cheque) => {
              const cfg = STATUS_CONFIG[cheque.status];
              const isExpanded = expandedId === cheque.id;
              const StatusIcon = cfg.icon;
              const isPast = new Date(cheque.chequeDate) < new Date();
              const isActionable =
                cheque.status === "pending" || cheque.status === "deposited";

              return (
                <div key={cheque.id} className="p-4">
                  {/* Main row */}
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : cheque.id)}
                  >
                    {/* Status icon */}
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${cfg.bg}`}>
                      <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-card-foreground">
                          {cheque.partyName}
                        </p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        {cheque.status === "pending" && isPast && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-destructive/10 text-destructive">
                            Due
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {cheque.chequeNo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {cheque.bankName}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(cheque.chequeDate)}
                        </span>
                      </div>
                    </div>

                    {/* Amount + chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <p
                        className={`text-sm font-mono font-bold ${
                          cheque.status === "cleared"
                            ? "text-success"
                            : cheque.status === "bounced"
                              ? "text-destructive"
                              : "text-card-foreground"
                        }`}
                      >
                        {formatCurrency(cheque.amount)}
                      </p>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 pl-11 space-y-3"
                    >
                      {/* Notes */}
                      {cheque.notes && (
                        <p className="text-xs text-muted-foreground italic">
                          "{cheque.notes}"
                        </p>
                      )}

                      {/* Cleared transaction note */}
                      {cheque.status === "cleared" &&
                        cheque.clearedTransactionId && (
                          <p className="text-xs text-success flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Payment transaction auto-created in ledger
                          </p>
                        )}

                      {/* Action buttons */}
                      {isActionable && (
                        <div className="flex flex-wrap gap-2">
                          {cheque.status === "pending" && (
                            <button
                              onClick={() =>
                                handleStatusUpdate(cheque.id, "deposited")
                              }
                              className="px-3 py-1.5 rounded-lg bg-info/10 text-info text-xs font-semibold hover:bg-info/20 transition"
                            >
                              📥 Mark Deposited
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleStatusUpdate(cheque.id, "cleared")
                            }
                            className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition"
                          >
                            ✓ Mark Cleared
                          </button>
                          <button
                            onClick={() =>
                              handleStatusUpdate(cheque.id, "bounced")
                            }
                            className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition"
                          >
                            ✗ Mark Bounced
                          </button>
                          <button
                            onClick={() =>
                              handleStatusUpdate(cheque.id, "cancelled")
                            }
                            className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteId(cheque.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete cheque
                      </button>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Delete Cheque"
        description="This will permanently delete the cheque record. Any linked payment transactions will NOT be deleted. Continue?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
