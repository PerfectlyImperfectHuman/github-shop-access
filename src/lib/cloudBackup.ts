import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, firestore } from "./firebase";
import { exportData, importData } from "./db";

// ── Phone helpers ────────────────────────────────────────────────────────────

export function formatPakistaniPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return digits.slice(0, 4) + "-" + digits.slice(4);
}

export function fromInternationalPhone(intl: string): string {
  if (intl.startsWith("+92")) {
    const local = "0" + intl.slice(3);
    return local.slice(0, 4) + "-" + local.slice(4);
  }
  return intl;
}

// Phone → fake Firebase email (03001234567 → 03001234567@bahi.app)
function phoneToEmail(phone: string): string {
  return phone.replace(/\D/g, "") + "@bahi.app";
}

// ── Recovery code ─────────────────────────────────────────────────────────────
// Format: BAHI-XXXX-XXXX (no ambiguous chars: I O 0 1)

const RC_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode(): string {
  const group = (len: number) =>
    Array.from(
      { length: len },
      () => RC_CHARS[Math.floor(Math.random() * RC_CHARS.length)],
    ).join("");
  return `BAHI-${group(4)}-${group(4)}`;
}

// ── Local encryption (PIN-based XOR — good enough for 4-digit PIN on device) ──

function encryptRC(rc: string, pin: string): string {
  const key = pin.repeat(Math.ceil(rc.length / pin.length)).slice(0, rc.length);
  return rc
    .split("")
    .map((c, i) =>
      (c.charCodeAt(0) ^ key.charCodeAt(i)).toString(16).padStart(2, "0"),
    )
    .join("");
}

function decryptRC(hex: string, pin: string): string {
  const bytes = (hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16));
  const raw = bytes.map((b) => String.fromCharCode(b)).join("");
  const key = pin
    .repeat(Math.ceil(raw.length / pin.length))
    .slice(0, raw.length);
  return raw
    .split("")
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i)))
    .join("");
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_PREFIX = "bahi_rc_";

function lsKey(phone: string): string {
  return LS_PREFIX + phone.replace(/\D/g, "");
}

export function hasLocalAccount(phone: string): boolean {
  return !!localStorage.getItem(lsKey(phone));
}

function saveRCLocally(phone: string, rc: string, pin: string): void {
  localStorage.setItem(lsKey(phone), encryptRC(rc, pin));
}

function loadRCLocally(phone: string, pin: string): string | null {
  const stored = localStorage.getItem(lsKey(phone));
  if (!stored) return null;
  try {
    const decoded = decryptRC(stored, pin);
    // Sanity check — recovery codes always start with "BAHI-"
    return decoded.startsWith("BAHI-") ? decoded : null;
  } catch {
    return null;
  }
}

function clearLocalRC(phone: string): void {
  localStorage.removeItem(lsKey(phone));
}

// ── Admin recovery key storage (in Firestore — readable by Taiyab via Console) ─

async function saveAdminKey(
  uid: string,
  phone: string,
  rc: string,
): Promise<void> {
  await setDoc(
    doc(firestore, "recovery", uid),
    {
      adminKey: rc, // plaintext — Taiyab sees this in Console
      phone: phone.replace(/\D/g, ""),
      email: phoneToEmail(phone),
      lastRotated: new Date().toISOString(),
    },
    { merge: true },
  );
}

// ── Auth operations ───────────────────────────────────────────────────────────

/** New user — creates Firebase account, stores PIN-encrypted RC locally and admin key in Firestore */
export async function signUpWithPhonePin(
  phone: string,
  pin: string,
): Promise<{ user: User; recoveryCode: string }> {
  const rc = generateRecoveryCode();
  const email = phoneToEmail(phone);

  // RC is the Firebase password — user never types it directly on this device
  const credential = await createUserWithEmailAndPassword(auth, email, rc);
  const user = credential.user;

  saveRCLocally(phone, rc, pin);
  await saveAdminKey(user.uid, phone, rc);

  return { user, recoveryCode: rc };
}

/** Returning user on same device — decrypts RC with PIN and signs in */
export async function signInWithPhonePin(
  phone: string,
  pin: string,
): Promise<User> {
  const rc = loadRCLocally(phone, pin);
  if (!rc)
    throw Object.assign(new Error("Wrong PIN or no account on this device"), {
      code: "bahi/wrong-pin",
    });

  const credential = await signInWithEmailAndPassword(
    auth,
    phoneToEmail(phone),
    rc,
  );
  return credential.user;
}

/** Recovery — user enters RC directly (new device / forgot PIN) */
export async function signInWithRecoveryCode(
  phone: string,
  recoveryCode: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    auth,
    phoneToEmail(phone),
    recoveryCode.toUpperCase().trim(),
  );
  return credential.user;
}

/** After recovery login — store the RC locally with a new PIN */
export async function setPinAfterRecovery(
  phone: string,
  pin: string,
  recoveryCode: string,
): Promise<void> {
  saveRCLocally(phone, recoveryCode, pin);
}

/**
 * Rotate the recovery code — called after admin-assisted recovery or by user choice.
 * Generates new RC, updates Firebase password, re-encrypts locally, updates Firestore.
 * Returns the new RC so the user can screenshot it.
 */
export async function rotateRecoveryCode(
  phone: string,
  pin: string,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const newRC = generateRecoveryCode();
  await updatePassword(user, newRC); // update Firebase auth password
  saveRCLocally(phone, newRC, pin); // re-encrypt locally with same PIN
  await saveAdminKey(user.uid, phone, newRC); // update Firestore admin key

  return newRC;
}

/** Sign out and clear local RC for this phone */
export async function signOutAndClear(phone: string): Promise<void> {
  clearLocalRC(phone);
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
  });
}

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

  await importData(
    JSON.stringify({
      ...restored,
      version: 4,
      exportedAt: new Date().toISOString(),
    }),
  );
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
