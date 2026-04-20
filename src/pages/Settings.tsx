import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Save,
  Download,
  Upload,
  Store,
  Shield,
  Moon,
  Sun,
  Info,
  Database,
  Palette,
  Languages,
  Printer,
  Check,
  Lock,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { initSettings, exportData, importData, db } from "@/lib/db";
import { clearPinSession } from "@/lib/pinSession";
import { PinNumpad, PinDots } from "@/pages/PinLock";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PhoneAuthModal } from "@/components/PhoneAuthModal";
import { toast } from "sonner";
import { useT, useLanguage } from "@/contexts/LanguageContext";
import {
  signOut,
  onAuthChange,
  getCurrentUser,
  backupToCloud,
  restoreFromCloud,
  getCloudBackupInfo,
  fromInternationalPhone,
} from "@/lib/cloudBackup";
import type { User } from "firebase/auth";
import type { Settings } from "@/types";

export default function SettingsPage() {
  const t = useT();
  const {
    lang,
    setLang,
    shopType,
    setShopType,
    printerWidth,
    setPrinterWidth,
  } = useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [pinPair, setPinPair] = useState({ a: "", b: "" });

  // Cloud backup state
  const [cloudUser, setCloudUser] = useState<User | null>(getCurrentUser());
  const [backupInfo, setBackupInfo] = useState<{
    backedUpAt: string;
    shopName: string;
  } | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  useEffect(() => {
    initSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  // Listen for auth state changes and load backup info
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setCloudUser(user);
      if (user) {
        const info = await getCloudBackupInfo();
        setBackupInfo(info);
      } else {
        setBackupInfo(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const { a, b } = pinPair;
    if (a.length !== 4 || b.length !== 4) return;
    if (a === b) {
      setSettings((s) => (s ? { ...s, pinCode: b } : s));
      setPinPair({ a: "", b: "" });
      toast.success(t("pin_ready_save"));
    } else {
      toast.error(t("pin_mismatch"));
      setPinPair({ a: "", b: "" });
    }
  }, [pinPair.a, pinPair.b, t]);

  const pinPadDigit = useCallback((d: string) => {
    setPinPair(({ a, b }) => {
      if (a.length < 4) return { a: a + d, b };
      if (b.length < 4) return { a, b: b + d };
      return { a, b };
    });
  }, []);

  const pinPadBack = useCallback(() => {
    setPinPair(({ a, b }) => {
      if (b.length > 0) return { a, b: b.slice(0, -1) };
      return { a: a.slice(0, -1), b };
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    if (settings.pinEnabled && !/^\d{4}$/.test(settings.pinCode)) {
      toast.error(t("pin_enable_needs_pin"));
      return;
    }
    setSaving(true);
    const prev = await db.settings.get("default");
    await db.settings.put(settings);
    if (
      prev &&
      (prev.pinCode !== settings.pinCode ||
        prev.pinEnabled !== settings.pinEnabled)
    )
      clearPinSession();
    setSaving(false);
    toast.success(t("settings_saved"));
  }

  async function handleExport() {
    const json = await exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bahi-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("backup_downloaded"));
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importData(text);
        toast.success(t("data_imported"));
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        toast.error(t("invalid_backup"));
      }
    };
    input.click();
  }

  async function executeClearAll() {
    await db.customers.clear();
    await db.transactions.clear();
    await db.products.clear();
    await db.suppliers.clear();
    await db.expenses.clear();
    toast.success(t("all_data_cleared"));
    setClearStep(0);
    setTimeout(() => window.location.reload(), 1000);
  }

  async function handlePhoneAuthSuccess(
    user: User,
    info: { backedUpAt: string; shopName: string } | null,
  ) {
    setCloudUser(user);
    setBackupInfo(info);
    setShowPhoneModal(false);
    toast.success("Number verify ho gaya — cloud backup active hai ✓");
    // Trigger first backup right away if no existing backup found
    if (!info) {
      try {
        await backupToCloud();
        const i = await getCloudBackupInfo();
        setBackupInfo(i);
      } catch {}
    }
  }

  async function handleCloudSignOut() {
    await signOut();
    setBackupInfo(null);
    toast.success("Cloud backup disconnected.");
  }

  async function handleBackupNow() {
    setCloudBusy(true);
    try {
      await backupToCloud();
      const info = await getCloudBackupInfo();
      setBackupInfo(info);
      toast.success("Backup saved to cloud ✓");
    } catch {
      toast.error("Backup failed. Check your internet connection.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleRestoreConfirmed() {
    setCloudBusy(true);
    setShowRestoreConfirm(false);
    try {
      await restoreFromCloud();
      toast.success("Data restored! Reloading...");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Restore failed. Please try again.");
    } finally {
      setCloudBusy(false);
    }
  }

  function formatBackupTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function toggleDarkMode() {
    if (!settings) return;
    const next = !settings.darkMode;
    setSettings((s) => (s ? { ...s, darkMode: next } : s));
    document.documentElement.classList.toggle("dark", next);
    db.settings.update("default", { darkMode: next });
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Reusable two-option choice card ──
  const ChoiceCard = <T extends string>({
    value,
    current,
    onClick,
    title,
    desc,
  }: {
    value: T;
    current: T;
    onClick: () => void;
    title: string;
    desc: string;
  }) => {
    const active = current === value;
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-start gap-3 w-full p-4 rounded-xl border-2 text-left transition-all ${
          active
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-border hover:border-muted-foreground/30 bg-card"
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
            active ? "bg-primary border-primary" : "border-border"
          }`}
        >
          {active && <Check className="w-3 h-3 text-primary-foreground" />}
        </div>
        <div>
          <p className="font-semibold text-card-foreground text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </button>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      {/* Language */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Languages className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-card-foreground">
            {t("language")}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard
            value="en"
            current={lang}
            onClick={() => setLang("en")}
            title={t("language_english")}
            desc="Use the app in English"
          />
          <ChoiceCard
            value="ur"
            current={lang}
            onClick={() => setLang("ur")}
            title={t("language_urdu")}
            desc="اردو میں استعمال کریں"
          />
        </div>
      </div>

      {/* Shop Mode */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-card-foreground">
            {t("shop_mode")}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard
            value="kiryana"
            current={shopType}
            onClick={() => setShopType("kiryana")}
            title={t("shop_mode_kiryana")}
            desc={t("shop_mode_kiryana_desc")}
          />
          <ChoiceCard
            value="pro"
            current={shopType}
            onClick={() => setShopType("pro")}
            title={t("shop_mode_pro")}
            desc={t("shop_mode_pro_desc")}
          />
        </div>
      </div>

      {/* Printer Width */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Printer className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-card-foreground">
            {t("printer_width")}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard
            value="58mm"
            current={printerWidth}
            onClick={() => setPrinterWidth("58mm")}
            title={t("printer_58mm")}
            desc={t("printer_58mm_desc")}
          />
          <ChoiceCard
            value="80mm"
            current={printerWidth}
            onClick={() => setPrinterWidth("80mm")}
            title={t("printer_80mm")}
            desc={t("printer_80mm_desc")}
          />
        </div>
      </div>

      {/* Shop Details */}
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSave}
        className="bg-card rounded-xl border border-border p-5 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-card-foreground">
            {t("shop_details")}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              label: t("shop_name"),
              key: "shopName" as const,
              placeholder: "My Dukan",
            },
            {
              label: t("owner_name"),
              key: "ownerName" as const,
              placeholder: "Owner",
            },
            {
              label: t("phone"),
              key: "phone" as const,
              placeholder: "03XX-XXXXXXX",
            },
            {
              label: t("currency_symbol"),
              key: "currency" as const,
              placeholder: "Rs.",
            },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {f.label}
              </label>
              <input
                value={settings[f.key]}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, [f.key]: e.target.value } : s,
                  )
                }
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("address")}
            </label>
            <input
              value={settings.address}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, address: e.target.value } : s))
              }
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("tax_rate")}
            </label>
            <input
              type="number"
              value={settings.taxRate || ""}
              placeholder="0"
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, taxRate: Number(e.target.value) } : s,
                )
              }
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("receipt_footer")}
            </label>
            <input
              value={settings.receiptFooter || ""}
              placeholder="Thank you!"
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, receiptFooter: e.target.value } : s,
                )
              }
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
        >
          <Save className="w-4 h-4" />{" "}
          {saving ? t("loading") : t("save_settings")}
        </button>
      </motion.form>

      {/* Appearance */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Palette className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-card-foreground">
            {t("appearance")}
          </h3>
        </div>
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl border border-border hover:bg-muted/50 transition text-left"
        >
          <div
            className={`p-2 rounded-lg ${settings.darkMode ? "bg-primary/10" : "bg-warning/10"}`}
          >
            {settings.darkMode ? (
              <Moon className="w-4 h-4 text-primary" />
            ) : (
              <Sun className="w-4 h-4 text-warning" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-card-foreground">
              {settings.darkMode ? t("dark_mode") : t("light_mode")}
            </p>
            <p className="text-xs text-muted-foreground">
              {settings.darkMode ? t("switch_to_light") : t("switch_to_dark")}
            </p>
          </div>
        </button>
      </div>

      {/* App PIN lock */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-card-foreground">
            {t("pin_section_title")}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 ml-11">
          {t("pin_section_desc")}
        </p>
        <div className="ml-0 sm:ml-11 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-card-foreground">
                {t("pin_require_lock")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("pin_require_lock_hint")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.pinEnabled}
              onClick={() => {
                if (!settings.pinEnabled) {
                  if (!/^\d{4}$/.test(settings.pinCode)) {
                    toast.error(t("pin_enable_needs_pin"));
                    return;
                  }
                }
                setSettings((s) =>
                  s ? { ...s, pinEnabled: !s.pinEnabled } : s,
                );
              }}
              className={cn(
                "relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                settings.pinEnabled ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-card shadow transition-transform",
                  settings.pinEnabled ? "left-7" : "left-1",
                )}
              />
            </button>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {t("pin_create_title")}
            </p>
            <PinDots filled={pinPair.a.length} />
            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">
              {t("pin_confirm_title")}
            </p>
            <PinDots filled={pinPair.b.length} />
            <p className="text-xs text-muted-foreground mt-2 mb-3">
              {t("pin_set_hint")}
            </p>
            <PinNumpad onDigit={pinPadDigit} onBackspace={pinPadBack} />
          </div>
        </div>
      </div>

      {/* ── Cloud Backup ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            {cloudUser ? (
              <Cloud className="w-4 h-4 text-primary" />
            ) : (
              <CloudOff className="w-4 h-4 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-display font-semibold text-card-foreground">
              Cloud Backup
            </h3>
            <p className="text-xs text-muted-foreground">
              Phone kho jaye toh bhi data safe rahe
            </p>
          </div>
        </div>

        {!cloudUser ? (
          // ── Signed out state ──
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-warning/10 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning font-medium">
                Cloud backup off hai. Phone reset ho ya app delete ho toh data
                kho sakta hai.
              </p>
            </div>

            {/* Phone auth button — trustworthy design */}
            <button
              onClick={() => setShowPhoneModal(true)}
              className="w-full flex items-center gap-4 px-4 py-3.5 bg-card border-2 border-primary/20 hover:border-primary/40 rounded-xl transition group shadow-sm"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition">
                <svg
                  className="w-5 h-5 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-card-foreground">
                  Phone number se connect karein
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  SMS OTP se verify karein — free, fast, secure
                </p>
              </div>
              <svg
                className="w-4 h-4 text-muted-foreground group-hover:text-primary transition shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-4 pt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <svg
                  className="w-3 h-3 text-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Firebase Secured
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <svg
                  className="w-3 h-3 text-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Auto-backup
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <svg
                  className="w-3 h-3 text-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Cross-device sync
              </div>
            </div>
          </div>
        ) : (
          // ── Signed in state ──
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 p-3.5 bg-success/8 border border-success/20 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-card-foreground">
                  {cloudUser.phoneNumber
                    ? fromInternationalPhone(cloudUser.phoneNumber)
                    : (cloudUser.email ?? "Connected")}
                </p>
                <p className="text-xs text-success font-medium">
                  Cloud backup active ✓
                </p>
              </div>
              <button
                onClick={handleCloudSignOut}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition shrink-0"
                title="Disconnect"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {backupInfo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Cloud className="w-3.5 h-3.5 text-success shrink-0" />
                <span>
                  Last backup:{" "}
                  <span className="font-medium text-foreground">
                    {formatBackupTime(backupInfo.backedUpAt)}
                  </span>
                </span>
              </div>
            )}
            {!backupInfo && (
              <p className="text-xs text-warning px-1">
                ⚠ No cloud backup yet — tap Backup Now
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleBackupNow}
                disabled={cloudBusy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {cloudBusy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Cloud className="w-4 h-4" />
                )}
                Backup Now
              </button>
              <button
                onClick={() => setShowRestoreConfirm(true)}
                disabled={cloudBusy || !backupInfo}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                Restore
              </button>
            </div>
            <p className="text-xs text-muted-foreground px-1">
              Auto-backup: tab switch ya browser close hone par automatically
              save hota hai
            </p>
          </div>
        )}
      </div>

      {/* ── Local Backup ──────────────────────────────────────────────── */}
      {/* Data Backup */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-card-foreground">
            {t("data_backup")}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 ml-11">
          {t("data_backup_desc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Download className="w-4 h-4" /> {t("export_backup")}
          </button>
          <button
            onClick={handleImport}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Upload className="w-4 h-4" /> {t("import_backup")}
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{t("import_warning")}</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card rounded-xl border border-destructive/30 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Shield className="w-4 h-4 text-destructive" />
          </div>
          <h3 className="font-display font-semibold text-destructive">
            {t("danger_zone")}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 ml-11">
          {t("danger_zone_desc")}
        </p>
        <button
          type="button"
          onClick={() => setClearStep(1)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          {t("clear_all_data")}
        </button>
      </div>

      {showPhoneModal && (
        <PhoneAuthModal
          onSuccess={handlePhoneAuthSuccess}
          onClose={() => setShowPhoneModal(false)}
        />
      )}

      <ConfirmDialog
        open={showRestoreConfirm}
        onOpenChange={(o) => {
          if (!o) setShowRestoreConfirm(false);
        }}
        title="Restore from Cloud"
        description={`This will replace ALL current data with your cloud backup${backupInfo ? ` (${formatBackupTime(backupInfo.backedUpAt)})` : ""}. This cannot be undone. Continue?`}
        confirmLabel="Restore"
        cancelLabel={t("cancel")}
        onConfirm={handleRestoreConfirmed}
      />
      <ConfirmDialog
        open={clearStep === 1}
        onOpenChange={(o) => {
          if (!o) setClearStep(0);
        }}
        title={t("danger_zone")}
        description={t("clear_warning_1")}
        confirmLabel={t("yes")}
        cancelLabel={t("cancel")}
        confirmVariant="primary"
        onConfirm={() => setClearStep(2)}
      />
      <ConfirmDialog
        open={clearStep === 2}
        onOpenChange={(o) => {
          if (!o) setClearStep(0);
        }}
        title={t("clear_all_data")}
        description={t("clear_warning_2")}
        confirmLabel={t("clear_all_data")}
        cancelLabel={t("cancel")}
        onConfirm={() => void executeClearAll()}
      />

      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground">{t("version_footer")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("offline_footer")}
        </p>
      </div>
    </div>
  );
}
