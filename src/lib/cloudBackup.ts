import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, firestore, googleProvider } from "./firebase";
import { exportData, importData } from "./db";

// ── Auth ────────────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// ── Backup ──────────────────────────────────────────────────────────────────
// Each table is stored as a separate Firestore document to stay under the 1MB limit.
// Path: backups/{uid}/tables/{tableName}

const TABLES = [
  "customers",
  "suppliers",
  "transactions",
  "products",
  "expenses",
  "settings",
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

  // Write meta document for quick info display
  await setDoc(doc(firestore, "backups", user.uid, "tables", "_meta"), {
    version: 3,
    backedUpAt: new Date().toISOString(),
    shopName: data.settings?.[0]?.shopName ?? "My Shop",
  });
}

// ── Restore ─────────────────────────────────────────────────────────────────

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
    version: 3,
    exportedAt: new Date().toISOString(),
  });
  await importData(json);
}

// ── Auto-backup on tab hide / browser close ──────────────────────────────────

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
