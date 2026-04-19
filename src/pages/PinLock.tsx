import { useState, useCallback } from "react";
import { Lock, Delete } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { setPinSessionUnlocked } from "@/lib/pinSession";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function PinDots({ filled, max = 4 }: { filled: number; max?: number }) {
  return (
    <div className="flex justify-center gap-3" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-3.5 w-3.5 rounded-full border-2 transition-colors",
            i < filled ? "border-primary bg-primary" : "border-muted-foreground/35 bg-transparent",
          )}
        />
      ))}
    </div>
  );
}

export function PinNumpad({
  disabled,
  onDigit,
  onBackspace,
}: {
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
}) {
  return (
    <div className="grid max-w-[280px] grid-cols-3 gap-2 mx-auto">
      {DIGITS.map(d => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(d)}
          className="flex h-14 items-center justify-center rounded-xl border border-border bg-card text-xl font-semibold text-card-foreground shadow-sm transition hover:bg-muted active:scale-95 disabled:opacity-50"
        >
          {d}
        </button>
      ))}
      <div className="h-14" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit("0")}
        className="flex h-14 items-center justify-center rounded-xl border border-border bg-card text-xl font-semibold text-card-foreground shadow-sm transition hover:bg-muted active:scale-95 disabled:opacity-50"
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        className="flex h-14 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground transition hover:bg-muted active:scale-95 disabled:opacity-50"
        aria-label="Backspace"
      >
        <Delete className="w-6 h-6" />
      </button>
    </div>
  );
}

interface PinLockProps {
  expectedPin: string;
  onSuccess: () => void;
}

export default function PinLock({ expectedPin, onSuccess }: PinLockProps) {
  const { t } = useLanguage();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  const tryComplete = useCallback(
    (next: string) => {
      if (next.length < 4) return;
      if (next === expectedPin) {
        setPinSessionUnlocked();
        onSuccess();
      } else {
        toast.error(t("pin_wrong"));
        setPin("");
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
      }
    },
    [expectedPin, onSuccess, t],
  );

  const onDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) tryComplete(next);
  };

  const onBackspace = () => setPin(s => s.slice(0, -1));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12">
      <motion.div
        animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 border border-primary/20">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">{t("pin_lock_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pin_enter")}</p>
        </div>

        <PinDots filled={pin.length} />

        <PinNumpad onDigit={onDigit} onBackspace={onBackspace} />
      </motion.div>
    </div>
  );
}
