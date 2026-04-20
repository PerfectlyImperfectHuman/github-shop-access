import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Phone, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  sendPhoneOTP,
  verifyPhoneOTP,
  formatPakistaniPhone,
  toInternationalPhone,
  getCloudBackupInfo,
} from "@/lib/cloudBackup";
import { toast } from "sonner";
import type { User } from "firebase/auth";

interface PhoneAuthModalProps {
  onSuccess: (user: User, backupInfo: { backedUpAt: string; shopName: string } | null) => void;
  onClose: () => void;
}

type Step = "phone" | "otp" | "success";

export function PhoneAuthModal({ onSuccess, onClose }: PhoneAuthModalProps) {
  const [step, setStep]             = useState<Step>("phone");
  const [phone, setPhone]           = useState("");          // formatted: 03XX-XXXXXXX
  const [otp, setOtp]               = useState(["", "", "", "", "", ""]);
  const [busy, setBusy]             = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Phone input handler ───────────────────────────────────────────────────
  function handlePhoneChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setPhone(formatPakistaniPhone(digits));
  }

  function isPhoneComplete(): boolean {
    return phone.replace(/\D/g, "").length === 11;
  }

  function isOtpComplete(): boolean {
    return otp.every(d => d !== "");
  }

  function startResendTimer() {
    setResendTimer(60);
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  async function handleSendOTP() {
    if (!isPhoneComplete()) { toast.error("Please enter a complete 11-digit number"); return; }
    setBusy(true);
    try {
      const intl = toInternationalPhone(phone);
      await sendPhoneOTP(intl);
      setStep("otp");
      startResendTimer();
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch (err: any) {
      const msg = err?.code === "auth/invalid-phone-number"
        ? "Invalid phone number. Make sure it starts with 03."
        : err?.code === "auth/too-many-requests"
          ? "Too many attempts. Please wait a few minutes."
          : "Failed to send OTP. Check your internet connection.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  async function handleVerifyOTP() {
    if (!isOtpComplete()) { toast.error("Enter all 6 digits"); return; }
    setBusy(true);
    try {
      const code = otp.join("");
      const user = await verifyPhoneOTP(code);
      const info = await getCloudBackupInfo();
      setStep("success");
      setTimeout(() => onSuccess(user, info), 1200);
    } catch (err: any) {
      const msg = err?.code === "auth/invalid-verification-code"
        ? "Wrong code. Please check the SMS and try again."
        : err?.code === "auth/code-expired"
          ? "Code expired. Please request a new one."
          : "Verification failed. Please try again.";
      toast.error(msg);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return;
    setBusy(true);
    try {
      const intl = toInternationalPhone(phone);
      await sendPhoneOTP(intl);
      setOtp(["", "", "", "", "", ""]);
      startResendTimer();
      toast.success("New OTP sent!");
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch {
      toast.error("Failed to resend. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── OTP digit box handlers ────────────────────────────────────────────────
  function handleOtpDigit(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && isOtpComplete()) handleVerifyOTP();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      setTimeout(() => inputRefs.current[5]?.focus(), 50);
    }
    e.preventDefault();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="relative px-6 pt-6 pb-4">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center gap-3 mb-1">
            {/* Icon */}
            <AnimatePresence mode="wait">
              {step === "success" ? (
                <motion.div key="success-icon"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12 }}
                  className="w-16 h-16 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </motion.div>
              ) : step === "otp" ? (
                <motion.div key="otp-icon"
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Phone className="w-7 h-7 text-primary" />
                </motion.div>
              ) : (
                <motion.div key="phone-icon"
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Shield className="w-7 h-7 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Title */}
            <div>
              <h2 className="font-display font-bold text-lg text-card-foreground">
                {step === "phone"   ? "Apna number darj karein" :
                 step === "otp"     ? "Code verify karein" :
                                      "Number verify ho gaya!"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {step === "phone"
                  ? "Aapke phone number par ek OTP code bheja jayega"
                  : step === "otp"
                    ? `6-digit code ${phone} par bheja gaya hai`
                    : "Cloud backup ab active hai — data safe ho gaya"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Step progress dots ── */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {["phone", "otp", "success"].map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${
              s === step ? "w-6 bg-primary" : i < ["phone","otp","success"].indexOf(step) ? "w-1.5 bg-success" : "w-1.5 bg-border"
            }`} />
          ))}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* ── Phone step ── */}
          {step === "phone" && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="text-base">🇵🇰</span>
                    <span className="text-sm text-muted-foreground font-medium">+92</span>
                    <div className="w-px h-4 bg-border" />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="03XX-XXXXXXX"
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && isPhoneComplete()) handleSendOTP(); }}
                    autoFocus
                    className="w-full pl-24 pr-4 py-3.5 rounded-xl border border-input bg-background text-foreground text-base font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                  Ek baar number darj karein — isi number se dono app aur web sync honge
                </p>
              </div>

              <button
                onClick={handleSendOTP}
                disabled={busy || !isPhoneComplete()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 active:scale-[0.98]">
                {busy
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <><span>OTP Code Bhejein</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </motion.div>
          )}

          {/* ── OTP step ── */}
          {step === "otp" && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              {/* 6 digit boxes */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-3 block text-center">
                  6-digit verification code
                </label>
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpDigit(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`w-11 h-13 text-center text-xl font-bold font-mono border-2 rounded-xl bg-background text-foreground transition focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 ${
                        digit ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      style={{ height: "52px" }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleVerifyOTP}
                disabled={busy || !isOtpComplete()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 active:scale-[0.98]">
                {busy
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /><span>Verify Karein</span></>
                }
              </button>

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0 || busy}
                  className="text-xs text-muted-foreground hover:text-primary transition disabled:opacity-50">
                  {resendTimer > 0
                    ? `Dobara bhejein (${resendTimer}s)`
                    : "Code nahi mila? Dobara bhejein"}
                </button>
              </div>

              <button
                onClick={() => { setStep("phone"); setOtp(["","","","","",""]); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center">
                ← Number badlein
              </button>
            </motion.div>
          )}

          {/* ── Success step ── */}
          {step === "success" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-2 space-y-3">
              <p className="text-sm text-success font-semibold">
                {phone} se connected hai
              </p>
              <p className="text-xs text-muted-foreground">
                Ab aapka data automatically cloud mein save hota rahega
              </p>
            </motion.div>
          )}
        </div>

        {/* ── Trust footer ── */}
        <div className="px-6 pb-5">
          <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-muted/50 border border-border">
            <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground text-center leading-tight">
              Secured by <span className="font-semibold text-foreground">Firebase</span> • OTP via SMS •
              Data sirf aapka — koi share nahi hota
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
