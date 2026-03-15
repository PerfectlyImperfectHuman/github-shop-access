/**
 * FirstRun — shown once when the app is first installed.
 * User picks their shop type, which configures navigation and features.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Store, ShoppingCart, Check, ArrowRight, BookOpen, BarChart3, Scan, MessageCircle, DollarSign, Users } from "lucide-react";
import { db, initSettings } from "@/lib/db";

interface FirstRunProps {
  onComplete: () => void;
}

type ShopType = "kiryana" | "pro";

const modes = [
  {
    type: "kiryana" as ShopType,
    emoji: "🏪",
    title: "Kiryana / Chota Dukan",
    urdu: "کریانہ / چھوٹی دکان",
    subtitle: "Simple udhar & khata tracking",
    bestFor: "General stores · Medical stores · Fruit shops · Tea stalls",
    color: "from-emerald-500 to-teal-600",
    borderActive: "border-emerald-500 ring-2 ring-emerald-500/30",
    features: [
      { icon: BookOpen,      text: "Customer udhar (khata) tracking" },
      { icon: MessageCircle, text: "WhatsApp balance reminders" },
      { icon: DollarSign,    text: "Quick payment recording" },
      { icon: Users,         text: "Daily closing report" },
    ],
  },
  {
    type: "pro" as ShopType,
    emoji: "🏬",
    title: "Bara Dukan / Pro",
    urdu: "بڑی دکان / پرو",
    subtitle: "Full POS + inventory management",
    bestFor: "Supermarkets · Pharmacies · Wholesale · Electronics",
    color: "from-blue-500 to-indigo-600",
    borderActive: "border-blue-500 ring-2 ring-blue-500/30",
    features: [
      { icon: Scan,      text: "Barcode scanner & POS" },
      { icon: Store,     text: "Product inventory tracking" },
      { icon: BarChart3, text: "Sales & profit reports" },
      { icon: BookOpen,  text: "Full udhar + khata system" },
    ],
  },
];

export default function FirstRun({ onComplete }: FirstRunProps) {
  const [selected, setSelected] = useState<ShopType | null>(null);
  const [saving, setSaving]     = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setSaving(true);
    const s = await initSettings();
    await db.settings.put({ ...s, shopType: selected });
    onComplete();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-y-auto">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-[#0d9668] to-[#065f46] pt-14 pb-10 px-6 text-center shrink-0">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-xl"
        >
          {/* Inline logo so no external image needed */}
          <svg viewBox="0 0 100 100" className="w-12 h-12">
            <path d="M11,31 Q11,27 15,28 L47,34 L47,77 L15,71 Q11,70 11,66 Z" fill="white" opacity="0.95"/>
            <path d="M89,31 Q89,27 85,28 L53,34 L53,77 L85,71 Q89,70 89,66 Z" fill="white" opacity="0.95"/>
            <rect x="45" y="32" width="10" height="46" rx="3" fill="rgba(255,255,255,0.2)"/>
            <rect x="17" y="41" width="24" height="2.5" rx="1.2" fill="rgba(255,255,255,0.45)"/>
            <rect x="17" y="48" width="24" height="2.5" rx="1.2" fill="rgba(255,255,255,0.45)"/>
            <rect x="17" y="55" width="16" height="2.5" rx="1.2" fill="rgba(255,255,255,0.45)"/>
            <path d="M61,53 L68,61 L83,43" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7"/>
          </svg>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl font-bold text-white tracking-tight"
        >
          Bahi
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="text-white/75 text-sm mt-1"
        >
          Pakistan ka Digital Bahi Khata
        </motion.p>
      </div>

      {/* Selection area */}
      <div className="flex-1 px-4 py-6 space-y-4 max-w-lg mx-auto w-full">
        <div className="text-center mb-2">
          <h2 className="text-lg font-display font-bold text-foreground">Apni dukan ka type chunein</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Choose your shop type to get the right features</p>
        </div>

        {modes.map((mode, i) => {
          const isSelected = selected === mode.type;
          return (
            <motion.button
              key={mode.type}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1 }}
              onClick={() => setSelected(mode.type)}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 bg-card shadow-sm ${
                isSelected ? mode.borderActive : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-2xl shrink-0`}>
                  {mode.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-display font-bold text-card-foreground text-base leading-tight">{mode.title}</p>
                      <p className="text-xs text-muted-foreground" style={{ fontFamily: "serif" }}>{mode.urdu}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? "bg-primary border-primary" : "border-border"
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{mode.subtitle}</p>
                </div>
              </div>

              {/* Features */}
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {mode.features.map(f => (
                  <div key={f.text} className="flex items-center gap-1.5">
                    <f.icon className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[11px] text-muted-foreground leading-tight">{f.text}</span>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[10px] text-muted-foreground/70 border-t border-border pt-2">
                Best for: {mode.bestFor}
              </p>
            </motion.button>
          );
        })}
      </div>

      {/* Continue button */}
      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-background border-t border-border">
        <AnimatePresence>
          {selected && (
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleContinue}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base hover:opacity-90 transition active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-primary/30"
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Shuru karein
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Settings mein baad mein bhi badal sakte hain
        </p>
      </div>
    </div>
  );
}
