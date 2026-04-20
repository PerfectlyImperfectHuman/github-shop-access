import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Shield,
  Phone,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  createRecaptchaVerifier,
  sendPhoneOTP,
  verifyPhoneOTP,
  formatPakistaniPhone,
  toInternationalPhone,
  getCloudBackupInfo,
} from "@/lib/cloudBackup";
import { toast } from "sonner";
import type { RecaptchaVerifier } from "firebase/auth";
import type { User } from "firebase/auth";

interface PhoneAuthModalProps {
  onSuccess: (
    user: User,
    backupInfo: { backedUpAt: string; shopName: string } | null,
  ) => void;
  onClose: () => void;
}

type Step = "phone" | "otp" | "success";

export function PhoneAuthModal({ onSuccess, onClose }: PhoneAuthModalProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // reCAPTCHA lives in a real mounted div — avoids the "F is null" crash
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize verifier once the modal div is in the DOM
  useEffect(() => {
    if (recaptchaRef.current) {
      verifierRef.current = createRecaptchaVerifier(recaptchaRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        verifierRef.current?.clear();
      } catch {}
      verifierRef.current = null;
    };
  }, []);

  function refreshVerifier() {
    try {
      verifierRef.current?.clear();
    } catch {}
    verifierRef.current = null;
    if (recaptchaRef.current) {
      verifierRef.current = createRecaptchaVerifier(recaptchaRef.current);
    }
  }

  function handlePhoneChange(raw: string) {
    setPhone(formatPakistaniPhone(raw.replace(/\D/g, "")));
  }

  function isPhoneComplete() {
    return phone.replace(/\D/g, "").length === 11;
  }

  function isOtpComplete() {
    return otp.every((d) => d !== "");
  }

  function startResendTimer() {
    setResendTimer(60);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  async function handleSendOTP() {
    if (!isPhoneComplete()) {
      toast.error("Pura 11-digit number darj karein (jaise: 0300-1234567)");
      return;
    }
    if (!verifierRef.current) {
      toast.error("Page refresh karein aur dobara try karein");
      return;
    }
    setBusy(true);
    try {
      const intl = toInternationalPhone(phone);
      await sendPhoneOTP(intl, verifierRef.current);
      setStep("otp");
      startResendTimer();
      setTimeout(() => inputRefs.current[0]?.focus(), 350);
    } catch (err: any) {
      console.error("OTP send error:", err);
      const code = err?.code ?? "";
      const msg =
        code === "auth/invalid-phone-number"
          ? "Phone number galat hai — 03 se shuru karna chahiye"
          : code === "auth/too-many-requests"
            ? "Bahut zyada attempts — kuch minutes baad try karein"
            : code === "auth/operation-not-allowed"
              ? "Phone sign-in enabled nahi — Firebase Console check karein"
              : code === "auth/network-request-failed"
                ? "Internet connection check karein"
                : code === "auth/captcha-check-failed"
                  ? "reCAPTCHA fail — page refresh karein aur dobara try karein"
                  : `Error (${code || "unknown"}) — dobara try karein`;
      toast.error(msg, { duration: 8000 });
      refreshVerifier();
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  async function handleVerifyOTP() {
    if (!isOtpComplete()) {
      toast.error("Poora 6-digit code darj karein");
      return;
    }
    setBusy(true);
    try {
      const code = otp.join("");
      const user = await verifyPhoneOTP(code);
      const info = await getCloudBackupInfo();
      setStep("success");
      setTimeout(() => onSuccess(user, info), 1200);
    } catch (err: any) {
      console.error("OTP verify error:", err);
      const code = err?.code ?? "";
      const msg =
        code === "auth/invalid-verification-code"
          ? "Code galat hai — SMS check karein aur dobara try karein"
          : code === "auth/code-expired"
            ? "Code expire ho gaya — naya code mangwayein"
            : "Verification fail — dobara try karein";
      toast.error(msg, { duration: 8000 });
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0 || busy) return;
    if (!verifierRef.current) refreshVerifier();
    setBusy(true);
    try {
      const intl = toInternationalPhone(phone);
      await sendPhoneOTP(intl, verifierRef.current!);
      setOtp(["", "", "", "", "", ""]);
      startResendTimer();
      toast.success("Naya code bhej diya gaya!");
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch {
      toast.error("Resend fail — dobara try karein");
      refreshVerifier();
    } finally {
      setBusy(false);
    }
  }

  function handleOtpDigit(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && isOtpComplete()) handleVerifyOTP();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Invisible reCAPTCHA container — must be in DOM before verifier init */}
      <div
        ref={recaptchaRef}
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          zIndex: -1,
          opacity: 0,
          pointerEvents: "none",
        }}
      />

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
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center gap-3">
            <AnimatePresence mode="wait">
              {step === "success" ? (
                <motion.div
                  key="s"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-16 h-16 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </motion.div>
              ) : step === "otp" ? (
                <motion.div
                  key="o"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                >
                  <Phone className="w-7 h-7 text-primary" />
                </motion.div>
              ) : (
                <motion.div
                  key="p"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                >
                  <Shield className="w-7 h-7 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <h2 className="font-display font-bold text-lg text-card-foreground">
                {step === "phone"
                  ? "Apna number darj karein"
                  : step === "otp"
                    ? "Code verify karein"
                    : "Connected!"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed px-2">
                {step === "phone"
                  ? "SMS OTP se verify karein — ek baar karo, hamesha sync rahega"
                  : step === "otp"
                    ? `6-digit code ${phone} par bheja gaya hai`
                    : "Cloud backup ab active hai — data safe ho gaya ✓"}
              </p>
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 py-4">
          {(["phone", "otp", "success"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step
                  ? "w-6 bg-primary"
                  : i < (["phone", "otp", "success"] as Step[]).indexOf(step)
                    ? "w-1.5 bg-success"
                    : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Phone step */}
          {step === "phone" && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Mobile Number
                </label>
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
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isPhoneComplete())
                        handleSendOTP();
                    }}
                    autoFocus
                    className="w-full pl-24 pr-4 py-3.5 rounded-xl border border-input bg-background text-foreground text-base font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                  Ek baar number darj karein — app aur web dono sync honge is
                  number se
                </p>
              </div>

              <button
                onClick={handleSendOTP}
                disabled={busy || !isPhoneComplete()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 active:scale-[0.98]"
              >
                {busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>OTP Code Bhejein</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* OTP step */}
          {step === "otp" && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-3 block text-center">
                  6-digit verification code
                </label>
                <div
                  className="flex gap-2 justify-center"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigit(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-11 text-center text-xl font-bold font-mono border-2 rounded-xl bg-background text-foreground transition focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 ${
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
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 active:scale-[0.98]"
              >
                {busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Karein</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0 || busy}
                  className="text-xs text-muted-foreground hover:text-primary transition disabled:opacity-50"
                >
                  {resendTimer > 0
                    ? `Dobara bhejein (${resendTimer}s)`
                    : "Code nahi mila? Dobara bhejein"}
                </button>
              </div>

              <button
                onClick={() => {
                  setStep("phone");
                  setOtp(["", "", "", "", "", ""]);
                  refreshVerifier();
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition text-center"
              >
                ← Number badlein
              </button>
            </motion.div>
          )}

          {/* Success step */}
          {step === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-2 space-y-2"
            >
              <p className="text-sm text-success font-semibold">
                {phone} verified ✓
              </p>
              <p className="text-xs text-muted-foreground">
                Data automatically cloud mein save hota rahega
              </p>
            </motion.div>
          )}
        </div>

        {/* Trust footer */}
        <div className="px-6 pb-5">
          <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-muted/50 border border-border">
            <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground text-center leading-tight">
              Secured by{" "}
              <span className="font-semibold text-foreground">Firebase</span> •
              OTP via SMS • Data sirf aapka
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
