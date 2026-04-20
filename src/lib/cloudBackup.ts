import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
  type ConfirmationResult,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, firestore } from "./firebase";
import { exportData, importData } from "./db";

// ── Phone number helpers ─────────────────────────────────────────────────────

export function formatPakistaniPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return digits.slice(0, 4) + "-" + digits.slice(4);
}

export function toInternationalPhone(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+92" + digits.slice(1);
  if (digits.startsWith("92")) return "+" + digits;
  return "+" + digits;
}

export function fromInternationalPhone(intl: string): string {
  if (intl.startsWith("+92")) {
    const local = "0" + intl.slice(3);
    return local.slice(0, 4) + "-" + local.slice(4);
  }
  return intl;
}

// ── reCAPTCHA ────────────────────────────────────────────────────────────────
// Caller passes in a real mounted DOM element — avoids the "F is null" crash
// that happens when we create the element dynamically before the DOM is ready.

export function createRecaptchaVerifier(
  element: HTMLElement,
): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, element, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {},
  });
}

// ── OTP ──────────────────────────────────────────────────────────────────────

let _confirmationResult: ConfirmationResult | null = null;

export async function sendPhoneOTP(
  internationalPhone: string,
  verifier: RecaptchaVerifier,
): Promise<void> {
  _confirmationResult = await signInWithPhoneNumber(
    auth,
    internationalPhone,
    verifier,
  );
}

export async function verifyPhoneOTP(code: string): Promise<User> {
  if (!_confirmationResult)
    throw new Error("No OTP session — call sendPhoneOTP first");
  const result = await _confirmationResult.confirm(code);
  return result.user;
}

// ── Auth state ───────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// ── Backup ───────────────────────────────────────────────────────────────────

const TABLES = [
  "customers",
  "suppliers",
  "transactions",
  "products",
  "expenses",
  "settings",
  "kists",
  "kistInstallments",
  "cheques",
] as const;

export async function backupToCloud(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const json = await exportData();
  const data = JSON.parse(json);

  await Promise.all(
    TABLES.map((table) =>
      setDoc(doc(firestore, "backups", user.uid, "tables", table), {
        data: JSON.stringify(data[table] ?? []),
        updatedAt: new Date().toISOString(),
      }),
    ),
  );

  await setDoc(doc(firestore, "backups", user.uid, "tables", "_meta"), {
    version: 4,
    backedUpAt: new Date().toISOString(),
    shopName: data.settings?.[0]?.shopName ?? "My Shop",
    phone: user.phoneNumber ?? "",
  });
}

// ── Restore ──────────────────────────────────────────────────────────────────

export async function getCloudBackupInfo(): Promise<{
  backedUpAt: string;
  shopName: string;
} | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(
      doc(firestore, "backups", user.uid, "tables", "_meta"),
    );
    if (!snap.exists()) return null;
    const d = snap.data();
    return { backedUpAt: d.backedUpAt, shopName: d.shopName };
  } catch {
    return null;
  }
}

export async function restoreFromCloud(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const restored: Record<string, unknown[]> = {};

  await Promise.all(
    TABLES.map(async (table) => {
      const snap = await getDoc(
        doc(firestore, "backups", user.uid, "tables", table),
      );
      restored[table] = snap.exists()
        ? JSON.parse(snap.data().data ?? "[]")
        : [];
    }),
  );

  const json = JSON.stringify({
    ...restored,
    version: 4,
    exportedAt: new Date().toISOString(),
  });
  await importData(json);
}

// ── Auto-backup ───────────────────────────────────────────────────────────────

let _autoSetup = false;
export function setupAutoBackup(): void {
  if (_autoSetup) return;
  _autoSetup = true;

  const tryBackup = () => {
    if (auth.currentUser) backupToCloud().catch(() => {});
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") tryBackup();
  });
  window.addEventListener("beforeunload", tryBackup);
}
