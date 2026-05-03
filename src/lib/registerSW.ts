/**
 * registerSW.ts — Service worker registration
 *
 * Skips SW registration when running inside Capacitor WebView.
 * In Capacitor, there is no network layer to intercept — the WebView
 * loads files directly from the app bundle. A SW in Capacitor can
 * actually BREAK Firebase by intercepting its internal fetch calls.
 *
 * Call this once from main.tsx BEFORE rendering the app.
 */

function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    // Capacitor sets this on the window object
    !!(window as any).Capacitor?.isNativePlatform?.()
  );
}

export function registerServiceWorker(): void {
  // Never register SW inside Capacitor — it breaks Firebase networking
  if (isCapacitor()) {
    // Unregister any previously installed SWs (cleanup)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    }
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  // Register only in production (not dev hot-reload)
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw-firebase-passthrough.js", { scope: "/" })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    });
  }
}
