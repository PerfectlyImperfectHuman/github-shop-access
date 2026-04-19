/** sessionStorage flag: user entered correct PIN this tab session */
export const PIN_SESSION_STORAGE_KEY = "bahi_pin_unlocked";

export function isPinSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(PIN_SESSION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPinSessionUnlocked(): void {
  try {
    sessionStorage.setItem(PIN_SESSION_STORAGE_KEY, "1");
  } catch { /* private mode */ }
}

export function clearPinSession(): void {
  try {
    sessionStorage.removeItem(PIN_SESSION_STORAGE_KEY);
  } catch { /* */ }
}
