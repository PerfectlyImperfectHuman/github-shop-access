import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "Rs."): string {
  return `${currency} ${Math.abs(amount).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function getGreetingKey(): "good_morning" | "good_afternoon" | "good_evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "good_morning";
  if (hour < 17) return "good_afternoon";
  return "good_evening";
}

export function isToday(date: string): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function daysAgo(date: string): number {
  const d = new Date(date);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Convert local PK phone to international format for wa.me links */
export function toIntlPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  if (digits.startsWith("92")) return digits;
  return "92" + digits;
}

/** Open a WhatsApp share link in a new tab. If `phone` empty → goes to wa.me/?text= for forwarding. */
export function shareOnWhatsApp(text: string, phone?: string) {
  const base = phone ? `https://wa.me/${toIntlPhone(phone)}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
