import { db } from "./db";

/** Ask for browser notification permission. Call once on app start. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** Fire a native notification for every low-stock product. Deduplicated by tag. */
export async function checkAndNotifyLowStock(): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;

  const products = await db.products.toArray();
  const low = products.filter(
    (p) => p.isActive && p.minStock > 0 && p.stock <= p.minStock,
  );

  if (low.length === 0) return;

  const body =
    low.length === 1
      ? `${low[0].name}: صرف ${low[0].stock} ${low[0].unit} bacha hai (min: ${low[0].minStock})`
      : low
          .slice(0, 4)
          .map((p) => `• ${p.name}: ${p.stock} ${p.unit}`)
          .join("\n") + (low.length > 4 ? `\n+${low.length - 4} more` : "");

  new Notification(
    `⚠️ Low Stock — Bahi (${low.length} item${low.length > 1 ? "s" : ""})`,
    {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: "bahi-low-stock", // replaces previous instead of stacking
      requireInteraction: false,
      silent: false,
    },
  );
}

/** Call this whenever stock changes to fire a notification if newly low. */
export function notifyIfNewlyLowStock(
  productName: string,
  stock: number,
  minStock: number,
  unit: string,
): void {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  if (minStock <= 0 || stock > minStock) return;
  new Notification(`⚠️ Low Stock — ${productName}`, {
    body: `${stock} ${unit} remaining (minimum: ${minStock})`,
    icon: "/icons/icon-192x192.png",
    tag: `bahi-stock-${productName}`,
    silent: true,
  });
}
