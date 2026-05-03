/**
 * firestoreListeners.ts -- Real-time Firestore -> Dexie sync
 *
 * Starts onSnapshot listeners for every collection under shops/{shopId}.
 * shopId is passed in (from membership resolution) -- NOT auth.currentUser.uid.
 * This means all members of a shop (owners + staff) listen to the same data.
 *
 * When Firestore delivers a change (from any device/member):
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
import { firestore } from "./firebase";
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
 * Start all Firestore listeners for a given shopId.
 * Pass shopId (first owner's uid), NOT the current user's uid.
 * Call after successful login and membership resolution.
 */
export function startFirestoreListeners(shopId: string): void {
  stopFirestoreListeners();

  for (const table of TABLES) {
    const collRef = collection(firestore, "shops", shopId, table);
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
