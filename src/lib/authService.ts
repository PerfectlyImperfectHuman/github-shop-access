/**
 * authService.ts — Phone + PIN authentication for Bahi
 *
 * HOW IT WORKS
 * ────────────
 * Firebase credential:
 *   email    = {digits}@bahi.app          e.g. 03001234567@bahi.app
 *   password = PBKDF2(pin, salt=phone)    derived in-browser, never stored
 *
 * Recovery code (BAHI-XXXX-XXXX):
 *   - Shown to user ONCE at registration
 *   - NEVER stored in plaintext anywhere
 *   - Firestore stores: SHA-256(RC) + AES-GCM(firebasePassword, key=RC)
 *   - Encrypted password lets us re-auth during PIN reset without knowing old PIN
 *
 * PIN reset flow:
 *   phone + RC → verify hash → decrypt old Firebase pw → re-auth →
 *   set new PBKDF2(newPin) password → new RC → store new hash + encrypted pw
 *
 * The 4-digit PIN ALWAYS derives the Firebase password. RC is only for reset.
 */

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

// ── Phone helpers ─────────────────────────────────────────────────────────────

export function formatPakistaniPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return digits.slice(0, 4) + "-" + digits.slice(4);
}

export function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function phoneToEmail(phone: string): string {
  return normalisePhone(phone) + "@bahi.app";
}

// ── PBKDF2 — PIN → Firebase password ─────────────────────────────────────────

async function deriveFirebasePassword(
  pin: string,
  phone: string,
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(normalisePhone(phone)),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

// ── Recovery code ─────────────────────────────────────────────────────────────

const RC_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I O 0 1

export function generateRecoveryCode(): string {
  const group = (n: number) =>
    Array.from(
      { length: n },
      () => RC_CHARS[Math.floor(Math.random() * RC_CHARS.length)],
    ).join("");
  return `BAHI-${group(4)}-${group(4)}`;
}

// ── SHA-256 hex ───────────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── AES-GCM encrypt / decrypt (RC as key) ────────────────────────────────────

async function getRCKey(rc: string, phone: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey(
    "raw",
    enc.encode(rc.toUpperCase().trim()),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(normalisePhone(phone) + "_rc"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptWithRC(
  plaintext: string,
  rc: string,
  phone: string,
): Promise<string> {
  const key = await getRCKey(rc, phone);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const out = new Uint8Array(12 + cipherBuf.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipherBuf), 12);
  return btoa(String.fromCharCode(...out));
}

async function decryptWithRC(
  b64: string,
  rc: string,
  phone: string,
): Promise<string> {
  const key = await getRCKey(rc, phone);
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf.slice(0, 12) },
    key,
    buf.slice(12),
  );
  return new TextDecoder().decode(plain);
}

// ── Firestore ─────────────────────────────────────────────────────────────────
//  shops/{uid}/private/recovery  →  { rcHash, encryptedPassword, phone, createdAt }
//  recoveryLookup/{sha256(phone)} →  { uid }

async function saveRecovery(
  uid: string,
  phone: string,
  rc: string,
  firebasePassword: string,
): Promise<void> {
  const [rcHash, encryptedPassword, phoneHash] = await Promise.all([
    sha256hex(rc.toUpperCase().trim()),
    encryptWithRC(firebasePassword, rc, phone),
    sha256hex(normalisePhone(phone)),
  ]);
  await Promise.all([
    setDoc(doc(firestore, "shops", uid, "private", "recovery"), {
      rcHash,
      encryptedPassword,
      phone: normalisePhone(phone),
      createdAt: new Date().toISOString(),
    }),
    setDoc(doc(firestore, "recoveryLookup", phoneHash), { uid }),
  ]);
}

async function getUidByPhone(phone: string): Promise<string | null> {
  const h = await sha256hex(normalisePhone(phone));
  const snap = await getDoc(doc(firestore, "recoveryLookup", h));
  return snap.exists() ? (snap.data().uid as string) : null;
}

async function fetchRecovery(uid: string): Promise<{
  rcHash: string;
  encryptedPassword: string;
  phone: string;
} | null> {
  const snap = await getDoc(
    doc(firestore, "shops", uid, "private", "recovery"),
  );
  if (!snap.exists()) return null;
  return snap.data() as {
    rcHash: string;
    encryptedPassword: string;
    phone: string;
  };
}

// ── localStorage — which phones have been used on this device ─────────────────
// Stores only digits. No secrets whatsoever.

const LS_KEY = "bahi_local_accounts_v2";

function getLocalAccounts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function hasLocalAccount(phone: string): boolean {
  return getLocalAccounts().includes(normalisePhone(phone));
}

function addLocalAccount(phone: string): void {
  const list = getLocalAccounts();
  const d = normalisePhone(phone);
  if (!list.includes(d))
    localStorage.setItem(LS_KEY, JSON.stringify([...list, d]));
}

function removeLocalAccount(phone: string): void {
  localStorage.setItem(
    LS_KEY,
    JSON.stringify(
      getLocalAccounts().filter((p) => p !== normalisePhone(phone)),
    ),
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a new account.
 * Returns recoveryCode — caller shows it once and NEVER stores it.
 */
export async function registerWithPhonePin(
  phone: string,
  pin: string,
): Promise<{ user: User; recoveryCode: string }> {
  const firebasePassword = await deriveFirebasePassword(pin, phone);
  const rc = generateRecoveryCode();

  const { user } = await createUserWithEmailAndPassword(
    auth,
    phoneToEmail(phone),
    firebasePassword,
  );

  await saveRecovery(user.uid, phone, rc, firebasePassword);
  addLocalAccount(phone);

  return { user, recoveryCode: rc };
}

/**
 * Sign in with phone + PIN (primary login — works on any device).
 * Throws Firebase auth/wrong-password if PIN is incorrect.
 */
export async function signInWithPhonePin(
  phone: string,
  pin: string,
): Promise<User> {
  const firebasePassword = await deriveFirebasePassword(pin, phone);
  const { user } = await signInWithEmailAndPassword(
    auth,
    phoneToEmail(phone),
    firebasePassword,
  );
  addLocalAccount(phone);
  return user;
}

/**
 * Reset a forgotten PIN using the recovery code.
 * Issues a NEW recovery code — caller shows it once.
 */
export async function resetPinWithRecoveryCode(
  phone: string,
  recoveryCode: string,
  newPin: string,
): Promise<{ user: User; newRecoveryCode: string }> {
  const rc = recoveryCode.toUpperCase().trim();

  const uid = await getUidByPhone(phone);
  if (!uid)
    throw Object.assign(new Error("Is number ka koi account nahi mila"), {
      code: "bahi/no-account",
    });

  const recovery = await fetchRecovery(uid);
  if (!recovery)
    throw Object.assign(new Error("Recovery data nahi mili"), {
      code: "bahi/no-recovery",
    });

  // Verify hash
  const enteredHash = await sha256hex(rc);
  if (enteredHash !== recovery.rcHash)
    throw Object.assign(new Error("Recovery code galat hai"), {
      code: "bahi/wrong-rc",
    });

  // Decrypt old Firebase password to re-auth
  let oldPassword: string;
  try {
    oldPassword = await decryptWithRC(recovery.encryptedPassword, rc, phone);
  } catch {
    throw Object.assign(
      new Error("Decrypt failed — recovery code bilkul sahi darj karein"),
      { code: "bahi/decrypt-failed" },
    );
  }

  // Sign in with old password
  const { user } = await signInWithEmailAndPassword(
    auth,
    phoneToEmail(phone),
    oldPassword,
  );

  // New PIN → new Firebase password → new RC
  const newFirebasePassword = await deriveFirebasePassword(newPin, phone);
  const newRC = generateRecoveryCode();

  await updatePassword(user, newFirebasePassword);
  await saveRecovery(uid, phone, newRC, newFirebasePassword);
  addLocalAccount(phone);

  return { user, newRecoveryCode: newRC };
}

/** Sign out. Optionally removes phone from this device's account list. */
export async function signOutAccount(phone?: string): Promise<void> {
  if (phone) removeLocalAccount(phone);
  await fbSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}
