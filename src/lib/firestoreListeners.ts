/**
 * firestoreListeners.ts -- Real-time Firestore -> Dexie sync
 *
 * Starts onSnapshot listeners for every collection under users/{uid}.
 * uid comes from auth.currentUser at the time listeners are started.
 *
 * When Firestore delivers a change (from any device):
 *   - If _deleted=true       -> delete from Dexie
 *   - If _updatedBy=DEVICE_ID -> skip (our own write echoing back)
 *   - Otherwise              -> upsert into Dexie -> triggers useLiveQuery
 */

import {
  collection,
  onSnapshot,
  query,
  type Unsubscribe,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { firestore, auth } from "./firebase";
import { db } from "./db";
import { DEVICE_ID, type SyncableTable } from "./syncService";

const TABLES: SyncableTable[] = [
  "customers",
  "suppliers",
  "transactions",
  "products",
  "expenses",
  "kists",
  "kistInstallments",
  "cheques",
];

let _unsubscribers: Unsubscribe[] = [];

/**
 * Start all Firestore listeners for the currently signed-in user.
 * Call after successful login.
 */
export function startFirestoreListeners(): void {
  stopFirestoreListeners();

  const user = auth.currentUser;
  if (!user) return;

  for (const table of TABLES) {
    const collRef = collection(firestore, "users", user.uid, table);
    const unsub = onSnapshot(
      query(collRef),
      { includeMetadataChanges: false },
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          handleDocChange(table, change.type, change.doc);
        });
      },
      (error) => {
        console.warn(`[sync] listener error on ${table}:`, error.message);
      },
    );
    _unsubscribers.push(unsub);
  }
}

export function stopFirestoreListeners(): void {
  _unsubscribers.forEach((unsub) => unsub());
  _unsubscribers = [];
}

async function handleDocChange(
  table: SyncableTable,
  changeType: "added" | "modified" | "removed",
  docSnap: QueryDocumentSnapshot,
): Promise<void> {
  const data = docSnap.data();

  // Skip our own writes echoing back
  if (data._updatedBy === DEVICE_ID) return;

  if (changeType === "removed" || data._deleted === true) {
    await (db[table] as any).delete(docSnap.id).catch(() => {});
    return;
  }

  const record = stripMeta(data);
  await (db[table] as any).put(record).catch((err: Error) => {
    console.warn(
      `[sync] Dexie put failed for ${table}/${docSnap.id}:`,
      err.message,
    );
  });
}

function stripMeta(data: Record<string, unknown>): Record<string, unknown> {
  const { _updatedAt, _updatedBy, _deleted, ...rest } = data;
  return rest;
}
