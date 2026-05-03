/**
 * syncService.ts -- Dexie <-> Firestore sync layer
 *
 * ARCHITECTURE
 * Every write goes through here:
 *   1. Write to Dexie immediately       -> useLiveQuery re-renders instantly
 *   2. If online  -> write to Firestore -> other devices get it via onSnapshot
 *   3. If offline -> queue the write    -> flush when back online
 *
 * MULTI-USER: shopId (first owner's uid) is stored in localStorage after login.
 * All members (owners + staff) write to shops/{shopId}/... regardless of their
 * own uid. This is what makes the shared account model work.
 *
 * CONFLICT RESOLUTION: last-write-wins per document via _updatedAt.
 */

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestore, auth } from "./firebase";
import { db } from "./db";

// -- Device ID: skip echo writes from our own onSnapshot -------------------

const DEVICE_ID_KEY = "bahi_device_id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export const DEVICE_ID = getDeviceId();

// -- ShopId management -----------------------------------------------------
// shopId = first owner's Firebase uid. Cached in localStorage so it's
// available synchronously inside syncPut/syncDelete without async calls.

const SHOP_ID_KEY = "bahi_shop_id";

export function setShopId(id: string): void {
  localStorage.setItem(SHOP_ID_KEY, id);
}

export function getShopId(): string | null {
  return localStorage.getItem(SHOP_ID_KEY);
}

export function clearShopId(): void {
  localStorage.removeItem(SHOP_ID_KEY);
}

// -- Firestore path helper -------------------------------------------------
// All shop data lives under shops/{shopId}/{collection}/{docId}

function shopRef(collectionName: string, docId: string) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const shopId = getShopId();
  if (!shopId) throw new Error("Shop not initialised — shopId missing");
  return doc(firestore, "shops", shopId, collectionName, docId);
}

// -- Core write ------------------------------------------------------------

/**
 * Write a record to Dexie + Firestore.
 * Dexie write is always synchronous (instant UI).
 * Firestore write is best-effort; queued if offline.
 */
export async function syncPut(
  table: SyncableTable,
  record: Record<string, unknown> & { id: string },
): Promise<void> {
  // 1. Always write to Dexie first
  await (db[table] as any).put(record);

  if (!auth.currentUser || !getShopId()) return;

  const firestoreDoc = {
    ...record,
    _updatedAt: serverTimestamp(),
    _updatedBy: DEVICE_ID,
    _deleted: false,
  };

  if (navigator.onLine) {
    try {
      await setDoc(shopRef(table, record.id), firestoreDoc, { merge: true });
    } catch {
      await queueWrite(table, record.id, record, "put");
    }
  } else {
    await queueWrite(table, record.id, record, "put");
  }
}

/**
 * Soft-delete in Firestore, hard-delete in Dexie.
 * Other devices see _deleted=true via onSnapshot and remove locally.
 */
export async function syncDelete(
  table: SyncableTable,
  id: string,
): Promise<void> {
  await (db[table] as any).delete(id);

  if (!auth.currentUser || !getShopId()) return;

  const tombstone = {
    id,
    _updatedAt: serverTimestamp(),
    _updatedBy: DEVICE_ID,
    _deleted: true,
  };

  if (navigator.onLine) {
    try {
      await setDoc(shopRef(table, id), tombstone, { merge: true });
    } catch {
      await queueWrite(table, id, { id }, "delete");
    }
  } else {
    await queueWrite(table, id, { id }, "delete");
  }
}

// -- Offline queue ---------------------------------------------------------

type QueueOp = "put" | "delete";

async function queueWrite(
  table: SyncableTable,
  id: string,
  data: Record<string, unknown>,
  op: QueueOp,
): Promise<void> {
  const queueId = `${table}__${id}`;
  await db.syncQueue.put({
    id: queueId,
    table,
    recordId: id,
    data,
    op,
    timestamp: Date.now(),
    retries: 0,
  });
}

/**
 * Flush all queued writes to Firestore.
 * Called on: app start (if logged in), window online event.
 */
export async function flushSyncQueue(): Promise<void> {
  if (!auth.currentUser || !getShopId() || !navigator.onLine) return;

  const queued = await db.syncQueue.toArray();
  if (queued.length === 0) return;

  await Promise.allSettled(
    queued.map(async (item) => {
      try {
        const ref = shopRef(item.table as SyncableTable, item.recordId);
        if (item.op === "delete") {
          await setDoc(
            ref,
            {
              id: item.recordId,
              _deleted: true,
              _updatedAt: serverTimestamp(),
              _updatedBy: DEVICE_ID,
            },
            { merge: true },
          );
        } else {
          await setDoc(
            ref,
            {
              ...item.data,
              _updatedAt: serverTimestamp(),
              _updatedBy: DEVICE_ID,
              _deleted: false,
            },
            { merge: true },
          );
        }
        await db.syncQueue.delete(item.id);
      } catch {
        if (item.retries >= 10) {
          await db.syncQueue.delete(item.id);
        } else {
          await db.syncQueue.update(item.id, { retries: item.retries + 1 });
        }
      }
    }),
  );
}

/**
 * Push ALL local Dexie data to Firestore.
 * Called once on first login for an account that has existing local data.
 */
export async function initialPushToFirestore(): Promise<void> {
  if (!auth.currentUser || !getShopId()) return;

  const tables: SyncableTable[] = [
    "customers",
    "suppliers",
    "transactions",
    "products",
    "expenses",
    "kists",
    "kistInstallments",
    "cheques",
  ];

  for (const table of tables) {
    const records = await (db[table] as any).toArray();
    await Promise.all(
      records.map((record: Record<string, unknown> & { id: string }) =>
        setDoc(
          shopRef(table, record.id),
          {
            ...record,
            _updatedAt: serverTimestamp(),
            _updatedBy: DEVICE_ID,
            _deleted: false,
          },
          { merge: true },
        ).catch(() => {}),
      ),
    );
  }
}

// -- Online listener -------------------------------------------------------

let _onlineListenerSetup = false;

export function setupOnlineListener(): void {
  if (_onlineListenerSetup) return;
  _onlineListenerSetup = true;
  window.addEventListener("online", () => {
    flushSyncQueue().catch(() => {});
  });
}

// -- Types -----------------------------------------------------------------

export type SyncableTable =
  | "customers"
  | "suppliers"
  | "transactions"
  | "products"
  | "expenses"
  | "kists"
  | "kistInstallments"
  | "cheques";
