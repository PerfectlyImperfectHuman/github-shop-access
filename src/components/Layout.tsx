import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  History,
  BarChart3,
  Settings,
  Menu,
  X,
  Package,
  Moon,
  Sun,
  ShoppingCart,
  ClipboardCheck,
  Truck,
  Banknote,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { db, initSettings } from "@/lib/db";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StringKey } from "@/lib/i18n";

interface NavItem {
  to: string;
  icon: any;
  labelKey: StringKey;
  primary?: boolean;
}

// ─── Kiryana mode: simple khata-focused nav (no products, no POS, no scan) ──
const karyanaNav: NavItem[] = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav_home" },
  { to: "/customers", icon: Users, labelKey: "nav_customers" },
  { to: "/suppliers", icon: Truck, labelKey: "nav_suppliers" },
  { to: "/cheques", icon: Banknote, labelKey: "nav_cheques" },
  { to: "/new-transaction", icon: PlusCircle, labelKey: "nav_udhar_wapsi" },
  { to: "/daily-close", icon: ClipboardCheck, labelKey: "nav_daily_close" },
  { to: "/settings", icon: Settings, labelKey: "nav_settings" },
];
const karyanaBottomNav: NavItem[] = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav_home" },
  { to: "/customers", icon: Users, labelKey: "nav_customers" },
  {
    to: "/new-transaction",
    icon: PlusCircle,
    labelKey: "nav_udhar",
    primary: true,
  },
  { to: "/daily-close", icon: ClipboardCheck, labelKey: "nav_close" },
  { to: "/settings", icon: Settings, labelKey: "nav_settings" },
];

// ─── Pro mode: full nav ─────────────────────────────────────────────────────
const proNav: NavItem[] = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav_dashboard" },
  { to: "/customers", icon: Users, labelKey: "nav_customers" },
  { to: "/suppliers", icon: Truck, labelKey: "nav_suppliers" },
  { to: "/cheques", icon: Banknote, labelKey: "nav_cheques" },
  { to: "/products", icon: Package, labelKey: "nav_products" },
  { to: "/new-transaction", icon: PlusCircle, labelKey: "nav_new_entry" },
  { to: "/sale", icon: ShoppingCart, labelKey: "nav_pos" },
  { to: "/transactions", icon: History, labelKey: "nav_history" },
  { to: "/reports", icon: BarChart3, labelKey: "nav_reports" },
  { to: "/daily-close", icon: ClipboardCheck, labelKey: "nav_daily_close" },
  { to: "/settings", icon: Settings, labelKey: "nav_settings" },
];
const proBottomNav: NavItem[] = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav_home" },
  { to: "/customers", icon: Users, labelKey: "nav_customers" },
  {
    to: "/new-transaction",
    icon: PlusCircle,
    labelKey: "nav_entry",
    primary: true,
  },
  { to: "/sale", icon: ShoppingCart, labelKey: "nav_pos" },
  { to: "/daily-close", icon: ClipboardCheck, labelKey: "nav_close" },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const { t, shopType, isUrdu } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    initSettings().then((s) => {
      if (s.darkMode) {
        setDarkMode(true);
        document.documentElement.classList.add("dark");
      }
    });
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    sync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const toggleDark = async () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    await db.settings.update("default", { darkMode: next });
  };

  const navItems = shopType === "kiryana" ? karyanaNav : proNav;
  const bottomNavItems =
    shopType === "kiryana" ? karyanaBottomNav : proBottomNav;
  const appName = t("app_name");
  const appSub =
    shopType === "kiryana" ? t("app_tagline_kiryana") : t("app_tagline_pro");

  const currentPage = navItems.find((n) => {
    if (n.to === "/") return location.pathname === "/";
    return location.pathname.startsWith(n.to);
  });
  const currentLabel = currentPage
    ? t(currentPage.labelKey)
    : location.pathname.startsWith("/customers/")
      ? t("nav_customers")
      : location.pathname.startsWith("/suppliers/")
        ? t("nav_suppliers")
        : t("app_name");

  const SidebarBrand = () => (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 100 100" className="w-5 h-5">
          <path
            d="M11,31 Q11,27 15,28 L47,34 L47,77 L15,71 Q11,70 11,66 Z"
            fill="currentColor"
            className="text-primary"
            opacity="0.9"
          />
          <path
            d="M89,31 Q89,27 85,28 L53,34 L53,77 L85,71 Q89,70 89,66 Z"
            fill="currentColor"
            className="text-primary"
            opacity="0.9"
          />
          <rect
            x="45"
            y="32"
            width="10"
            height="46"
            rx="3"
            fill="currentColor"
            className="text-sidebar"
            opacity="0.4"
          />
          <path
            d="M61,53 L68,61 L83,43"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.5"
          />
        </svg>
      </div>
      <div>
        <h1 className="font-display font-bold text-base tracking-tight">
          {appName}
        </h1>
        <p
          className={cn(
            "text-[10px] text-sidebar-foreground/50 tracking-wide",
            !isUrdu && "uppercase",
          )}
        >
          {appSub}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {!online && (
        <div
          role="status"
          className="shrink-0 w-full border-b border-amber-600/25 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:border-amber-400/30 dark:bg-amber-500 dark:text-amber-950"
        >
          Offline mode — data saves locally
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-[240px] bg-sidebar text-sidebar-foreground shrink-0">
          <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-accent">
            <SidebarBrand />
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )
                }
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-sidebar-accent flex items-center justify-between">
            <p className="text-[11px] text-sidebar-foreground/40">
              {t("offline_footer")}
            </p>
            <button
              onClick={toggleDark}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent transition text-sidebar-foreground/60"
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: isUrdu ? 280 : -280 }}
                animate={{ x: 0 }}
                exit={{ x: isUrdu ? 280 : -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={cn(
                  "fixed inset-y-0 z-50 w-[240px] bg-sidebar text-sidebar-foreground lg:hidden flex flex-col",
                  isUrdu ? "right-0" : "left-0",
                )}
              >
                <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-accent">
                  <SidebarBrand />
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-sidebar-accent"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="px-3 py-4 space-y-0.5 flex-1 overflow-y-auto">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60",
                        )
                      }
                    >
                      <item.icon className="w-[18px] h-[18px]" />
                      {t(item.labelKey)}
                    </NavLink>
                  ))}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="font-display font-semibold text-base text-foreground truncate">
                {currentLabel}
              </h2>
            </div>
            <button
              onClick={toggleDark}
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition shrink-0"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-foreground" />
              ) : (
                <Moon className="w-5 h-5 text-foreground" />
              )}
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-6 lg:p-6">
            <Outlet />
          </main>

          {/* Mobile Bottom Nav */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
            <div className="flex items-center justify-around px-1 py-1.5">
              {bottomNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-medium transition-all",
                      item.primary
                        ? "text-primary-foreground bg-primary px-4 rounded-2xl shadow-sm shadow-primary/40"
                        : isActive
                          ? "text-primary"
                          : "text-muted-foreground",
                    )
                  }
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate leading-tight">
                    {t(item.labelKey)}
                  </span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
