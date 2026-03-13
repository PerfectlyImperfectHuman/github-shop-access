import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, PlusCircle, History, BarChart3, Settings,
  Store, Menu, X, Package, Moon, Sun, ShoppingCart,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { initSettings, db } from "@/lib/db";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/products", icon: Package, label: "Products" },
  { to: "/new-transaction", icon: PlusCircle, label: "New Entry" },
  { to: "/sale", icon: ShoppingCart, label: "POS / Sale" },
  { to: "/transactions", icon: History, label: "History" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const mobileBottomNav = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/new-transaction", icon: PlusCircle, label: "New Entry", primary: true },
  { to: "/sale", icon: ShoppingCart, label: "POS" },
  { to: "/transactions", icon: History, label: "History" },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    initSettings().then(s => {
      if (s.darkMode) { setDarkMode(true); document.documentElement.classList.add("dark"); }
    });
  }, []);

  const toggleDark = async () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    await db.settings.update("default", { darkMode: next });
  };

  const currentPage = navItems.find(n => {
    if (n.to === "/") return location.pathname === "/";
    return location.pathname.startsWith(n.to);
  })?.label ?? (location.pathname.startsWith("/customers/") ? "Customer Ledger" : "Dashboard");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-sidebar text-sidebar-foreground shrink-0">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-accent">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-base tracking-tight">Dukan Manager</h1>
            <p className="text-[10px] text-sidebar-foreground/50 tracking-wide uppercase">Pakistan Edition</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-accent">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-sidebar-foreground/40">Offline Ready • PWA</p>
            <button onClick={toggleDark} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition text-sidebar-foreground/60">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar text-sidebar-foreground lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-accent">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                    <Store className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h1 className="font-display font-bold text-base">Dukan Manager</h1>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-sidebar-accent">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="px-3 py-4 space-y-0.5 flex-1 overflow-y-auto">
                {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60"
                      )
                    }
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between px-4 lg:px-8 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="font-display font-semibold text-base lg:text-lg text-foreground">{currentPage}</h2>
          </div>
          <button onClick={toggleDark} className="lg:hidden p-2 rounded-lg hover:bg-muted transition">
            {darkMode ? <Sun className="w-5 h-5 text-foreground" /> : <Moon className="w-5 h-5 text-foreground" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-8 lg:p-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {mobileBottomNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all min-w-0",
                    item.primary
                      ? isActive
                        ? "text-primary-foreground bg-primary rounded-xl px-4"
                        : "text-primary-foreground bg-primary/90 rounded-xl px-4 hover:bg-primary"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <item.icon className={cn("shrink-0", item.primary ? "w-5 h-5" : "w-5 h-5")} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
