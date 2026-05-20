/**
 * modeConfig.ts — Single source of truth for the Mode System.
 *
 * Architecture decisions:
 * - Every feature is declared ONCE here with its minimum required mode.
 * - No scattered if-statements anywhere in the app.
 * - Adding a new feature = one entry in ALL_FEATURES.
 * - Adding a new mode = one entry in MODE_RANK + update affected minMode values.
 */

import {
  LayoutDashboard,
  Users,
  PlusCircle,
  History,
  BarChart3,
  Settings,
  Package,
  ShoppingCart,
  ClipboardCheck,
  Truck,
  Banknote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StringKey } from "@/lib/i18n";

// ─── Mode type ────────────────────────────────────────────────────────────────

/**
 * Modes ordered from least to most capable.
 * The numeric rank is used to check "does mode X include feature Y?"
 * without needing a lookup table or switch statement.
 */
export const MODE_RANK = {
  simple: 0,
  pro: 1,
  advanced: 2,
} as const;

export type AppMode = keyof typeof MODE_RANK;

/** Returns true if `mode` grants access to a feature with `minMode`. */
export function modeIncludes(mode: AppMode, minMode: AppMode): boolean {
  return MODE_RANK[mode] >= MODE_RANK[minMode];
}

// ─── Feature registry ─────────────────────────────────────────────────────────

export interface FeatureConfig {
  /** Stable unique key used internally */
  key: string;
  /** Route path */
  to: string;
  icon: LucideIcon;
  labelKey: StringKey;
  /** The least-powerful mode that can access this feature */
  minMode: AppMode;
  /**
   * If true: appears in desktop sidebar but NOT in the mobile bottom nav.
   * Use for secondary features that don't need a persistent thumb-tap target.
   */
  sidebarOnly?: boolean;
  /**
   * If true: renders as the highlighted primary-action button in mobile bottom nav.
   * Only one feature should have this per nav set.
   */
  primaryAction?: boolean;
}

/**
 * THE master feature list. Order determines sidebar display order.
 * This is the ONLY place you add new features.
 */
export const ALL_FEATURES: FeatureConfig[] = [
  // ── Simple ─────────────────────────────────────────────────────────────────
  {
    key: "dashboard",
    to: "/",
    icon: LayoutDashboard,
    labelKey: "nav_home",
    minMode: "simple",
  },
  {
    key: "customers",
    to: "/customers",
    icon: Users,
    labelKey: "nav_customers",
    minMode: "simple",
  },
  {
    key: "products",
    to: "/products",
    icon: Package,
    labelKey: "nav_products",
    minMode: "simple",
  },
  {
    key: "new_transaction",
    to: "/new-transaction",
    icon: PlusCircle,
    labelKey: "nav_udhar_wapsi",
    minMode: "simple",
    primaryAction: true,
  },
  {
    key: "settings",
    to: "/settings",
    icon: Settings,
    labelKey: "nav_settings",
    minMode: "simple",
  },

  // ── Pro ────────────────────────────────────────────────────────────────────
  {
    key: "suppliers",
    to: "/suppliers",
    icon: Truck,
    labelKey: "nav_suppliers",
    minMode: "pro",
  },
  {
    key: "pos",
    to: "/sale",
    icon: ShoppingCart,
    labelKey: "nav_pos",
    minMode: "pro",
  },
  {
    key: "transactions",
    to: "/transactions",
    icon: History,
    labelKey: "nav_history",
    minMode: "pro",
    sidebarOnly: true,
  },
  {
    key: "daily_close",
    to: "/daily-close",
    icon: ClipboardCheck,
    labelKey: "nav_daily_close",
    minMode: "pro",
  },

  // ── Advanced ───────────────────────────────────────────────────────────────
  {
    key: "reports",
    to: "/reports",
    icon: BarChart3,
    labelKey: "nav_reports",
    minMode: "advanced",
    sidebarOnly: true,
  },
  {
    key: "cheques",
    to: "/cheques",
    icon: Banknote,
    labelKey: "nav_cheques",
    minMode: "advanced",
    sidebarOnly: true,
  },
];

// ─── Derived nav helpers ──────────────────────────────────────────────────────

/** All features the sidebar should show for a given mode. */
export function getSidebarFeatures(mode: AppMode): FeatureConfig[] {
  return ALL_FEATURES.filter((f) => modeIncludes(mode, f.minMode));
}

/**
 * Features for the mobile bottom nav (max 5 for thumb-reachability).
 * Rules:
 *  - Exclude sidebarOnly features
 *  - Pick the most important anchors per mode
 */
export function getBottomNavFeatures(mode: AppMode): FeatureConfig[] {
  const BOTTOM_NAV_KEYS: Record<AppMode, string[]> = {
    simple: ["dashboard", "customers", "new_transaction", "settings"],
    pro: ["dashboard", "customers", "new_transaction", "pos", "daily_close"],
    advanced: ["dashboard", "customers", "new_transaction", "pos", "daily_close"],
  };

  const allowedKeys = BOTTOM_NAV_KEYS[mode];
  return ALL_FEATURES.filter(
    (f) =>
      allowedKeys.includes(f.key) &&
      modeIncludes(mode, f.minMode) &&
      !f.sidebarOnly,
  );
}

/**
 * Returns true if the given pathname is accessible in the given mode.
 * Used by ModeGuard to protect routes.
 */
export function isRouteAllowed(pathname: string, mode: AppMode): boolean {
  // Normalise sub-routes to their parent (e.g. /customers/abc → /customers)
  const base =
    pathname === "/" ? "/" : "/" + pathname.replace(/^\//, "").split("/")[0];

  const feature = ALL_FEATURES.find((f) => {
    if (f.to === "/") return base === "/";
    return base === f.to || base.startsWith(f.to);
  });

  // If no feature matched (unknown route), allow it — catch-all handles it
  if (!feature) return true;
  return modeIncludes(mode, feature.minMode);
}

// ─── Mode metadata for UI ─────────────────────────────────────────────────────

export interface ModeInfo {
  mode: AppMode;
  label: string;
  tagline: string;
  audience: string;
  /** Tailwind colour classes for the selector card */
  colorClasses: string;
  /** Feature bullets shown in the selector */
  features: string[];
}

export const MODE_INFO: Record<AppMode, ModeInfo> = {
  simple: {
    mode: "simple",
    label: "Simple",
    tagline: "Bas zaroorat ki cheezein",
    audience: "Chaiwala · Fruit vendor · Choti kiryana",
    colorClasses:
      "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    features: [
      "Dashboard",
      "Customers & Udhaar",
      "Products",
      "Payments",
      "Settings",
    ],
  },
  pro: {
    mode: "pro",
    label: "Pro",
    tagline: "Poori dukan manage karein",
    audience: "Kiryana store · General store",
    colorClasses:
      "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    features: [
      "Everything in Simple, plus:",
      "Suppliers",
      "POS / Sales",
      "Transaction History",
      "Daily Close",
    ],
  },
  advanced: {
    mode: "advanced",
    label: "Advanced",
    tagline: "Business-level tools",
    audience: "Pharmacy · Electronics · Wholesale",
    colorClasses:
      "text-violet-700 bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
    features: [
      "Everything in Pro, plus:",
      "Reports & Analytics",
      "Cheque Management",
    ],
  },
};

// ─── Migration helper ──────────────────────────────────────────────────────────

/**
 * Normalises legacy / raw shopType values to the new AppMode type.
 * "kiryana" → "simple"  (v1 backward compat)
 * ""        → "simple"  (fresh install default)
 */
export function normaliseMode(raw: string | undefined | null): AppMode {
  if (raw === "pro" || raw === "advanced") return raw;
  return "simple";
}
