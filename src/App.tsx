import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { initSettings } from "./lib/db";

export default function App() {
  const [ready, setReady] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    initSettings().then(s => setReady(!!s.shopType));
  }, []);

  // Loading splash
  if (ready === null) {
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

  // First run — no nav, full screen
  if (!ready) {
    return (
      <BrowserRouter>
        <FirstRun onComplete={() => setReady(true)} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerLedger />} />
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
  );
}
