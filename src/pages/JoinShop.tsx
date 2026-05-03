/**
 * JoinShop.tsx
 *
 * Shown to a logged-in user who has no shop membership yet.
 * Two paths:
 *   1. "Naya shop banana hai" — creates a fresh shop (becomes owner)
 *   2. "Code darj karein"     — joins existing shop via 6-digit invite code (staff/owner)
 *
 * After completion, calls onComplete(shopId) so App.tsx can start listeners.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Users, ArrowRight, RefreshCw, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/authService";
import { initShopForNewOwner, joinShopWithCode } from "@/lib/membershipService";
import { initSettings, db } from "@/lib/db";

interface JoinShopProps {
  onComplete: (shopId: string) => void;
}

type Step = "choose" | "create" | "join" | "success";

export default function JoinShop({ onComplete }: JoinShopProps) {
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);

  // Create form
  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");

  // Join form
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");

  async function handleCreate() {
    if (!ownerName.trim()) { toast.error("Apna naam darj karein"); return; }
    if (!shopName.trim())  { toast.error("Dukan ka naam darj karein"); return; }
    setBusy(true);
    try {
      const user = getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      // Save shop name to local settings
      const s = await initSettings();
      await db.settings.put({ ...s, shopName: shopName.trim(), ownerName: ownerName.trim() });

      const shopId = await initShopForNewOwner(user.uid, ownerName.trim(), "");
      setStep("success");
      setTimeout(() => onComplete(shopId), 800);
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const code = inviteCode.trim().replace(/\D/g, "");
    if (code.length !== 6) { toast.error("6-digit code darj karein"); return; }
    if (!memberName.trim()) { toast.error("Apna naam darj karein"); return; }
    setBusy(true);
    try {
      const user = getCurrentUser();
      if (!user) throw new Error("Not authenticated");
      const info = await joinShopWithCode(code, memberName.trim(), "");
      setStep("success");
      setTimeout(() => onComplete(info.shopId), 800);
    } catch (err: any) {
      const c = err?.code ?? "";
      if (c === "bahi/invalid-invite") toast.error("Code galat hai — dobara check karein");
      else if (c === "bahi/invite-expired") toast.error("Code expire ho gaya — owner se naya code mangin");
      else if (c === "bahi/already-member") toast.error("Aap pehle se ek shop se connected hain");
      else toast.error(`Error: ${err?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">Apni dukan setup karein</h1>
          <p className="text-sm text-muted-foreground">Naya shop banayein ya kisi shop mein shamil hon</p>
        </div>

        <AnimatePresence mode="wait">

          {/* Choose */}
          {step === "choose" && (
            <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <button
                onClick={() => setStep("create")}
                className="w-full flex items-center gap-4 px-4 py-4 bg-card border-2 border-primary/20 hover:border-primary/40 rounded-xl transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-card-foreground text-sm">Naya shop banana hai</p>
                  <p className="text-xs text-muted-foreground">Main owner hoon — pehli baar setup kar raha hoon</p>
                </div>
              </button>
              <button
                onClick={() => setStep("join")}
                className="w-full flex items-center gap-4 px-4 py-4 bg-card border-2 border-border hover:border-muted-foreground/30 rounded-xl transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-card-foreground text-sm">Invite code se join karein</p>
                  <p className="text-xs text-muted-foreground">Owner ne mujhe code diya hai</p>
                </div>
              </button>
            </motion.div>
          )}

          {/* Create shop */}
          {step === "create" && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Aapka naam</label>
                <input
                  autoFocus
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ali Raza"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Dukan ka naam</label>
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  placeholder="Ali General Store"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Shop Banayein</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <button onClick={() => setStep("choose")} className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center">
                <- Wapas
              </button>
            </motion.div>
          )}

          {/* Join with code */}
          {step === "join" && (
            <motion.div key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Aapka naam</label>
                <input
                  autoFocus
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Ahmed"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">6-digit Invite Code</label>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                  placeholder="123456"
                  inputMode="numeric"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-xl font-mono tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={busy || inviteCode.length !== 6 || !memberName.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4" /><span>Shop Join Karein</span></>}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                Code 15 minute mein expire ho jata hai — owner se fresh code mangin
              </p>
              <button onClick={() => setStep("choose")} className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center">
                <- Wapas
              </button>
            </motion.div>
          )}

          {/* Success */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <p className="font-semibold text-card-foreground">Shop connected!</p>
              <p className="text-xs text-muted-foreground">App khul rahi hai...</p>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
