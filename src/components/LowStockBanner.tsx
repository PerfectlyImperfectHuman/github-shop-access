/**
 * LowStockBanner — shows a dismissible alert listing all products
 * whose stock is at or below their minimum. Reactively updates via
 * useLiveQuery, so it appears/disappears as stock changes in real time.
 *
 * Usage: drop <LowStockBanner /> anywhere in Products.tsx (or any page).
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  X,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function LowStockBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lowStock =
    useLiveQuery(
      () =>
        db.products
          .filter((p) => p.isActive && p.minStock > 0 && p.stock <= p.minStock)
          .toArray()
          .then((list) => list.sort((a, b) => a.stock - b.stock)), // worst first
      [],
    ) ?? [];

  // Re-show banner if new items become low after dismissal
  const [lastCount, setLastCount] = useState(0);
  if (lowStock.length > lastCount) {
    setLastCount(lowStock.length);
    setDismissed(false);
  }

  if (dismissed || lowStock.length === 0) return null;

  const visible = expanded ? lowStock : lowStock.slice(0, 3);
  const hidden = lowStock.length - 3;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-xl border border-warning/40 bg-warning/5 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="p-1.5 rounded-lg bg-warning/20 shrink-0">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {lowStock.length} item{lowStock.length > 1 ? "s" : ""} low on
              stock
            </p>
            <p className="text-xs text-muted-foreground">
              Reorder karein warna stock khatam ho jayegi
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product rows */}
        <div className="border-t border-warning/20 divide-y divide-warning/10">
          {visible.map((p) => {
            const isCritical = p.stock === 0;
            return (
              <div
                key={p.id}
                onClick={() => navigate("/products")}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-warning/10 cursor-pointer transition-colors"
              >
                {/* Icon */}
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${isCritical ? "bg-destructive/15" : "bg-warning/15"}`}
                >
                  <Package
                    className={`w-3.5 h-3.5 ${isCritical ? "text-destructive" : "text-warning"}`}
                  />
                </div>

                {/* Name + category */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>

                {/* Stock status */}
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-mono font-bold ${isCritical ? "text-destructive" : "text-warning"}`}
                  >
                    {isCritical ? "OUT" : `${p.stock} ${p.unit}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    min: {p.minStock} {p.unit}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show more / less toggle */}
        {lowStock.length > 3 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-warning hover:bg-warning/10 transition border-t border-warning/20"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> +{hidden} more items
              </>
            )}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
