import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
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

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
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
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
