import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Shield,
  Phone,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import {
  registerWithPhonePin,
  signInWithPhonePin,
  resetPinWithRecoveryCode,
  hasLocalAccount,
  formatPakistaniPhone,
} from "@/lib/authService";
import { getCloudBackupInfo, restoreFromCloud } from "@/lib/cloudBackup";
import { initialPushToFirestore } from "@/lib/syncService";
import { toast } from "sonner";
import type { User } from "firebase/auth";

interface AccountModalProps {
  onSuccess: (
    user: User,
    backupInfo: { backedUpAt: string; shopName: string } | null,
  ) => void;
  onClose: () => void;
}

type Step =
  | "phone" // enter phone number
  | "pin-signin" // returning user → enter PIN
  | "choose" // new device: new user OR have account?
  | "signup-pin" // new user → set PIN
  | "show-recovery" // show recovery code once, user must confirm
  | "recovery-entry" // forgot PIN → enter RC + new PIN
  | "success";

// ── PIN input ─────────────────────────────────────────────────────────────────

function PinInput({
  label,
  value,
  onChange,
  onEnter,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground block">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.length === 4 && onEnter) onEnter();
          }}
          disabled={disabled}
          placeholder="••••"
          className="w-full px-4 py-3.5 rounded-xl border border-input bg-background text-foreground text-xl font-mono tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Recovery code display ─────────────────────────────────────────────────────

function RecoveryCodeBox({
  code,
  onCopy,
}: {
  code: string;
  onCopy: () => void;
}) {
  return (
    <div className="bg-muted/60 border-2 border-dashed border-primary/30 rounded-xl p-4 text-center space-y-2">
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
        Recovery Code
      </p>
      <p className="text-2xl font-mono font-bold text-primary tracking-widest select-all">
        {code}
      </p>
      <button
        onClick={onCopy}
        className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-primary transition"
      >
        <Copy className="w-3.5 h-3.5" /> Copy code
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function AccountModal({ onSuccess, onClose }: AccountModalProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  // Recovery flow: user enters RC + new PIN in one step
  const [recoveryInput, setRecoveryInput] = useState("");
  const [newPinForReset, setNewPinForReset] = useState("");
  const [confirmNewPinForReset, setConfirmNewPinForReset] = useState("");
  // Shown after signup / after reset
  const [recoveryCode, setRecoveryCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signedInUser, setSignedInUser] = useState<User | null>(null);

  function handlePhoneChange(raw: string) {
    setPhone(formatPakistaniPhone(raw.replace(/\D/g, "")));
  }

  function isPhoneComplete() {
    return phone.replace(/\D/g, "").length === 11;
  }

  function copyCode() {
    navigator.clipboard.writeText(recoveryCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Phone next ───────────────────────────────────────────────────────────────

  function handlePhoneNext() {
    if (!isPhoneComplete()) {
      toast.error("Pura 11-digit number darj karein");
      return;
    }
    setStep(hasLocalAccount(phone) ? "pin-signin" : "choose");
  }

  // ── Sign-in with PIN ─────────────────────────────────────────────────────────

  async function handlePinSignIn() {
    if (pin.length !== 4) {
      toast.error("4-digit PIN darj karein");
      return;
    }
    setBusy(true);
    try {
      const user = await signInWithPhonePin(phone, pin);
      const info = await getCloudBackupInfo();
      if (!info) {
        // No cloud backup yet — push this device's local data up
        await initialPushToFirestore().catch(() => {});
      } else {
        // Cloud backup exists — pull it down so this device is in sync
        await restoreFromCloud().catch(() => {});
      }
      setSignedInUser(user);
      setStep("success");
      setTimeout(() => onSuccess(user, info), 900);
    } catch (err: any) {
      const code = err?.code ?? "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        toast.error("PIN galat hai — dobara try karein", { duration: 5000 });
      } else {
        toast.error(`Error: ${code || err?.message || "unknown"}`);
      }
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  // ── Sign-up ──────────────────────────────────────────────────────────────────

  async function handleSignUp() {
    if (pin.length !== 4) {
      toast.error("4-digit PIN set karein");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("PIN match nahi kar raha");
      setConfirmPin("");
      return;
    }
    setBusy(true);
    try {
      const { user, recoveryCode: rc } = await registerWithPhonePin(phone, pin);
      // New account — push any existing local Dexie data to Firestore
      await initialPushToFirestore().catch(() => {});
      setRecoveryCode(rc);
      setSignedInUser(user);
      setConfirmed(false);
      setStep("show-recovery");
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code === "auth/email-already-in-use") {
        toast.error(
          "Yeh number pehle se registered hai — 'Mere paas account hai' choose karein",
        );
        setStep("choose");
      } else {
        toast.error(`Signup fail: ${code || err?.message || "unknown"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  // ── After showing recovery code ──────────────────────────────────────────────

  async function handleRecoveryConfirmed() {
    if (!confirmed) {
      toast.error("Pehle confirm karein ke code save kar liya");
      return;
    }
    const info = await getCloudBackupInfo();
    if (!info) {
      await initialPushToFirestore().catch(() => {});
    } else {
      await restoreFromCloud().catch(() => {});
    }
    setStep("success");
    setTimeout(() => onSuccess(signedInUser!, info), 900);
  }

  // ── PIN reset via recovery code ───────────────────────────────────────────────
  // User enters: RC + new PIN (both on one screen)

  async function handlePinReset() {
    if (!recoveryInput.trim()) {
      toast.error("Recovery code darj karein");
      return;
    }
    if (newPinForReset.length !== 4) {
      toast.error("Naya 4-digit PIN darj karein");
      return;
    }
    if (newPinForReset !== confirmNewPinForReset) {
      toast.error("PIN match nahi kar raha");
      setConfirmNewPinForReset("");
      return;
    }
    setBusy(true);
    try {
      const { user, newRecoveryCode } = await resetPinWithRecoveryCode(
        phone,
        recoveryInput,
        newPinForReset,
      );
      setSignedInUser(user);
      setRecoveryCode(newRecoveryCode);
      setConfirmed(false);
      setStep("show-recovery"); // show new RC
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code === "bahi/no-account") {
        toast.error("Is number ka koi account nahi mila");
      } else if (code === "bahi/wrong-rc") {
        toast.error(
          "Recovery code galat hai — bilkul sahi darj karein (BAHI-XXXX-XXXX)",
        );
      } else if (code === "bahi/decrypt-failed") {
        toast.error("Code se verify nahi hua — barabar check karein");
      } else if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        toast.error("Authentication fail — recovery code sahi nahi");
      } else {
        toast.error(`Error: ${code || err?.message || "unknown"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Step labels ──────────────────────────────────────────────────────────────

  const stepTitle: Record<Step, string> = {
    phone: "Apna number darj karein",
    "pin-signin": "PIN darj karein",
    choose: "Account ka kya status hai?",
    "signup-pin": "Naya PIN set karein",
    "show-recovery": "Recovery code save karein",
    "recovery-entry": "PIN reset karein",
    success: "Connected!",
  };

  const stepSub: Record<Step, string> = {
    phone: "Phone number se cloud backup enable hoga",
    "pin-signin": phone || "is number ka PIN",
    choose: "Naya account banayein ya pehle waale se login karein",
    "signup-pin": "4 digits — yaad rakhein ya likh lein",
    "show-recovery":
      "⚠️ Yeh code zaroori hai — phone kho jaaye toh isi se PIN reset hoga",
    "recovery-entry": "Recovery code + naya PIN ek saath set karein",
    success: "Cloud backup active hai ✓",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-2">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center gap-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${
                  step === "success"
                    ? "bg-success/10 border-success/20"
                    : step === "show-recovery"
                      ? "bg-warning/10 border-warning/20"
                      : "bg-primary/10 border-primary/20"
                }`}
              >
                {step === "success" ? (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                ) : step === "show-recovery" ? (
                  <KeyRound className="w-7 h-7 text-warning" />
                ) : step === "pin-signin" || step === "signup-pin" ? (
                  <Shield className="w-7 h-7 text-primary" />
                ) : step === "recovery-entry" ? (
                  <RotateCcw className="w-7 h-7 text-primary" />
                ) : (
                  <Phone className="w-7 h-7 text-primary" />
                )}
              </motion.div>
            </AnimatePresence>
            <div>
              <h2 className="font-display font-bold text-lg text-card-foreground">
                {stepTitle[step]}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed px-2">
                {stepSub[step]}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {/* ── Phone entry ── */}
          {step === "phone" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                  <span className="text-base">🇵🇰</span>
                  <span className="text-sm text-muted-foreground font-medium">
                    +92
                  </span>
                  <div className="w-px h-4 bg-border" />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="03XX-XXXXXXX"
                  value={phone}
                  autoFocus
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isPhoneComplete())
                      handlePhoneNext();
                  }}
                  className="w-full pl-24 pr-4 py-3.5 rounded-xl border border-input bg-background text-foreground text-base font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <button
                onClick={handlePhoneNext}
                disabled={!isPhoneComplete()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                <span>Aage chalein</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── PIN sign-in ── */}
          {step === "pin-signin" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <PinInput
                label={`${phone} ka PIN`}
                value={pin}
                onChange={setPin}
                onEnter={handlePinSignIn}
                disabled={busy}
              />
              <button
                onClick={handlePinSignIn}
                disabled={busy || pin.length !== 4}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Login Karein</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setPin("");
                  setNewPinForReset("");
                  setConfirmNewPinForReset("");
                  setRecoveryInput("");
                  setStep("recovery-entry");
                }}
                className="w-full text-xs text-muted-foreground hover:text-primary transition text-center"
              >
                PIN bhool gaye? Recovery code se reset karein →
              </button>
              <button
                onClick={() => {
                  setPhone("");
                  setPin("");
                  setStep("phone");
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center"
              >
                ← Number badlein
              </button>
            </motion.div>
          )}

          {/* ── Choose: new or existing ── */}
          {step === "choose" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <button
                onClick={() => setStep("signup-pin")}
                className="w-full flex items-center gap-4 px-4 py-3.5 bg-primary/5 border-2 border-primary/20 hover:border-primary/40 rounded-xl transition text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    Naya account banana hai
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pehli baar use kar rahe hain
                  </p>
                </div>
              </button>
              <button
                onClick={() => {
                  setPin("");
                  setStep("pin-signin");
                }}
                className="w-full flex items-center gap-4 px-4 py-3.5 bg-muted/40 border-2 border-border hover:border-muted-foreground/30 rounded-xl transition text-left"
              >
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    Mere paas account hai
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dusre phone ya reinstall ke baad
                  </p>
                </div>
              </button>
              <button
                onClick={() => {
                  setPhone("");
                  setStep("phone");
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center pt-1"
              >
                ← Number badlein
              </button>
            </motion.div>
          )}

          {/* ── Sign-up: set PIN ── */}
          {step === "signup-pin" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <PinInput
                label="Naya PIN banayein (4 digits)"
                value={pin}
                onChange={setPin}
                disabled={busy}
              />
              <PinInput
                label="PIN dobara darj karein"
                value={confirmPin}
                onChange={setConfirmPin}
                onEnter={handleSignUp}
                disabled={busy}
              />
              <button
                onClick={handleSignUp}
                disabled={busy || pin.length !== 4 || confirmPin.length !== 4}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Account Banayein</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setPin("");
                  setConfirmPin("");
                  setStep("choose");
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center"
              >
                ← Wapas
              </button>
            </motion.div>
          )}

          {/* ── Show recovery code ── */}
          {step === "show-recovery" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <RecoveryCodeBox code={recoveryCode} onCopy={copyCode} />

              <div className="space-y-1.5 text-xs text-muted-foreground bg-warning/8 border border-warning/20 rounded-xl p-3">
                <p className="font-semibold text-warning">
                  Yeh code kyun zaroori hai?
                </p>
                <p>
                  • Phone kho jaaye ya reset ho → isi code + naya PIN se login
                  hoga
                </p>
                <p>• PIN bhool jaayein → yeh code kaam aayega</p>
                <p>• Screenshot lein ya likh kar mahfooz rakhein</p>
                <p className="text-success font-medium">
                  ✓ Har PIN reset par naya code milega
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                />
                <span className="text-xs text-card-foreground">
                  Mujhe samajh aa gaya — maine yeh code save kar liya hai
                </span>
              </label>

              <button
                onClick={handleRecoveryConfirmed}
                disabled={!confirmed}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Tayyar hoon, aage chalein
              </button>
            </motion.div>
          )}

          {/* ── Recovery entry + new PIN (one screen) ── */}
          {step === "recovery-entry" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Recovery Code (BAHI-XXXX-XXXX)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="BAHI-XXXX-XXXX"
                  value={recoveryInput}
                  onChange={(e) =>
                    setRecoveryInput(e.target.value.toUpperCase())
                  }
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground font-mono tracking-widest text-center text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
              <PinInput
                label="Naya PIN set karein"
                value={newPinForReset}
                onChange={setNewPinForReset}
                disabled={busy}
              />
              <PinInput
                label="Naya PIN confirm karein"
                value={confirmNewPinForReset}
                onChange={setConfirmNewPinForReset}
                onEnter={handlePinReset}
                disabled={busy}
              />
              <button
                onClick={handlePinReset}
                disabled={
                  busy ||
                  !recoveryInput.trim() ||
                  newPinForReset.length !== 4 ||
                  confirmNewPinForReset.length !== 4
                }
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>PIN Reset Karein</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-muted-foreground text-center px-2">
                Agar yeh code bhi nahi hai toh Bahi support se rabta karein
              </p>
              <button
                onClick={() => {
                  setStep(
                    hasLocalAccount(phone.replace(/\D/g, ""))
                      ? "pin-signin"
                      : "choose",
                  );
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center"
              >
                ← Wapas
              </button>
            </motion.div>
          )}

          {/* ── Success ── */}
          {step === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-2 space-y-2"
            >
              <p className="text-sm text-success font-semibold">
                {phone} se connected ✓
              </p>
              <p className="text-xs text-muted-foreground">
                Data ab automatically cloud mein save hota rahega
              </p>
            </motion.div>
          )}
        </div>

        {/* Trust footer */}
        {step !== "success" && step !== "show-recovery" && (
          <div className="px-6 pb-5">
            <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-muted/50 border border-border">
              <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
              <p className="text-[10px] text-muted-foreground text-center leading-tight">
                Secured by{" "}
                <span className="font-semibold text-foreground">Firebase</span>{" "}
                • Data sirf aapka • Koi payment nahi
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
