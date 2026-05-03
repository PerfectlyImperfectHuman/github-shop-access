/**
 * cloudBackup.ts — Firestore backup & restore
 *
 * Auth is handled entirely by authService.ts.
 * This file only deals with data backup/restore.
 */

import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, firestore } from "./firebase";
import { exportData, importData } from "./db";

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

// ── Backup ────────────────────────────────────────────────────────────────────

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
    version: 5,
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
      version: 5,
      exportedAt: new Date().toISOString(),
    }),
  );
}

// ── Auto-backup on tab hide / close ──────────────────────────────────────────

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
