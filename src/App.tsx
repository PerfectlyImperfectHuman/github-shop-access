import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerLedger from "./pages/CustomerLedger";
import NewTransaction from "./pages/NewTransaction";
import TransactionHistory from "./pages/TransactionHistory";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import SaleReceipt from "./pages/SaleReceipt";
import DailyClose from "./pages/DailyClose";
import FirstRun from "./pages/FirstRun";
import Suppliers from "./pages/Suppliers";
import SupplierLedger from "./pages/SupplierLedger";
<<<<<<< HEAD
import PinLock from "./pages/PinLock";
import { initSettings } from "./lib/db";
import { isPinSessionUnlocked } from "./lib/pinSession";
import { LanguageProvider } from "./contexts/LanguageContext";
import type { Settings } from "./types";

type BootPhase = "splash" | "first_run" | "pin" | "main";
=======
import { initSettings } from "./lib/db";
import { LanguageProvider } from "./contexts/LanguageContext";
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572

export default function App() {
  const [phase, setPhase] = useState<BootPhase>("splash");
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    initSettings().then(s => {
      setSettings(s);
      if (!s.shopType) setPhase("first_run");
      else if (s.pinEnabled && /^\d{4}$/.test(s.pinCode) && !isPinSessionUnlocked()) setPhase("pin");
      else setPhase("main");
    });
  }, []);

  const handleFirstRunComplete = () => {
    initSettings().then(s => {
      setSettings(s);
      if (s.pinEnabled && /^\d{4}$/.test(s.pinCode) && !isPinSessionUnlocked()) setPhase("pin");
      else setPhase("main");
    });
  };

  const handlePinSuccess = () => setPhase("main");

  if (phase === "splash") {
    return (
      <div className="min-h-screen bg-[#0d9668] flex items-center justify-center">
        <div className="text-center space-y-3">
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto">
            <path d="M11,31 Q11,27 15,28 L47,34 L47,77 L15,71 Q11,70 11,66 Z" fill="white" opacity="0.95"/>
            <path d="M89,31 Q89,27 85,28 L53,34 L53,77 L85,71 Q89,70 89,66 Z" fill="white" opacity="0.95"/>
            <rect x="45" y="32" width="10" height="46" rx="3" fill="rgba(255,255,255,0.2)"/>
            <path d="M61,53 L68,61 L83,43" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7"/>
          </svg>
          <p className="text-white/80 text-sm font-medium">Bahi</p>
        </div>
      </div>
    );
  }

  return (
    <LanguageProvider>
<<<<<<< HEAD
      <Toaster position="top-center" richColors />
      {phase === "first_run" ? (
        <BrowserRouter>
          <FirstRun onComplete={handleFirstRunComplete} />
        </BrowserRouter>
      ) : phase === "pin" && settings && /^\d{4}$/.test(settings.pinCode) ? (
        <PinLock expectedPin={settings.pinCode} onSuccess={handlePinSuccess} />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerLedger />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/:id" element={<SupplierLedger />} />
              <Route path="/new-transaction" element={<NewTransaction />} />
              <Route path="/transactions" element={<TransactionHistory />} />
              <Route path="/products" element={<Products />} />
              <Route path="/sale" element={<SaleReceipt />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/daily-close" element={<DailyClose />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      )}
=======
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerLedger />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/suppliers/:id" element={<SupplierLedger />} />
            <Route path="/new-transaction" element={<NewTransaction />} />
            <Route path="/transactions" element={<TransactionHistory />} />
            <Route path="/products" element={<Products />} />
            <Route path="/sale" element={<SaleReceipt />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/daily-close" element={<DailyClose />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
>>>>>>> 87ebf8479c61fd3a980d116edbcae7ffca596572
    </LanguageProvider>
  );
}
