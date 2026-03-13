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
