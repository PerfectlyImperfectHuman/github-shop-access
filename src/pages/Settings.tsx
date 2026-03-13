import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Download, Upload, Store, Shield, Moon, Sun } from "lucide-react";
import { initSettings, exportData, importData, db } from "@/lib/db";
import { toast } from "sonner";
import type { Settings } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    await db.settings.put(settings);
    toast.success("Settings saved");
  }

  async function handleExport() {
    const json = await exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dukan-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importData(text);
        toast.success("Data imported successfully. Refreshing...");
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        toast.error("Invalid backup file");
      }
    };
    input.click();
  }

  async function handleClearAll() {
    if (!confirm("⚠ This will DELETE ALL DATA (customers, transactions, products). This cannot be undone! Are you sure?")) return;
    if (!confirm("Last chance — are you REALLY sure? All data will be permanently lost.")) return;
    await db.customers.clear();
    await db.transactions.clear();
    await db.products.clear();
    toast.success("All data cleared");
    setTimeout(() => window.location.reload(), 1000);
  }

  function toggleDarkMode() {
    if (!settings) return;
    const next = !settings.darkMode;
    setSettings(s => s ? { ...s, darkMode: next } : s);
    document.documentElement.classList.toggle("dark", next);
    db.settings.update("default", { darkMode: next });
  }

  if (loading || !settings) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      {/* Shop Settings */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSave}
        className="bg-card rounded-xl border border-border p-5 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-5">
          <Store className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-card-foreground">Shop Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Shop Name", key: "shopName" as const, placeholder: "My Shop" },
            { label: "Owner Name", key: "ownerName" as const, placeholder: "Owner" },
            { label: "Phone", key: "phone" as const, placeholder: "03XX-XXXXXXX" },
            { label: "Currency Symbol", key: "currency" as const, placeholder: "Rs." },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
              <input
                value={settings[f.key]}
                onChange={e => setSettings(s => s ? { ...s, [f.key]: e.target.value } : s)}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
            <input
              value={settings.address}
              onChange={e => setSettings(s => s ? { ...s, address: e.target.value } : s)}
              placeholder="Shop address"
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tax Rate (%)</label>
            <input
              type="number"
              value={settings.taxRate || ""}
              onChange={e => setSettings(s => s ? { ...s, taxRate: Number(e.target.value) } : s)}
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Receipt Footer</label>
            <input
              value={settings.receiptFooter || ""}
              onChange={e => setSettings(s => s ? { ...s, receiptFooter: e.target.value } : s)}
              placeholder="Thank you!"
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <button type="submit" className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </motion.form>

      {/* Appearance */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-display font-semibold mb-4 text-card-foreground">Appearance</h3>
        <button onClick={toggleDarkMode} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition w-full">
          {settings.darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-warning" />}
          <div className="text-left">
            <p className="text-sm font-medium text-card-foreground">{settings.darkMode ? "Dark Mode" : "Light Mode"}</p>
            <p className="text-xs text-muted-foreground">Click to switch</p>
          </div>
        </button>
      </div>

      {/* Data Management */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-display font-semibold mb-3 text-card-foreground">Data Backup & Restore</h3>
        <p className="text-xs text-muted-foreground mb-4">Export as JSON backup or import a previous backup. Always back up before major changes.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleExport} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
            <Download className="w-4 h-4" /> Export Backup
          </button>
          <button onClick={handleImport} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
            <Upload className="w-4 h-4" /> Import Backup
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card rounded-xl border border-destructive/30 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-destructive" />
          <h3 className="font-display font-semibold text-destructive">Danger Zone</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Permanently delete all customers, transactions, and products. This cannot be undone.</p>
        <button onClick={handleClearAll} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
          Clear All Data
        </button>
      </div>

      {/* Version */}
      <div className="text-center text-xs text-muted-foreground py-2">
        Dukan Manager v2.0 • Made for Pakistan 🇵🇰
      </div>
    </div>
  );
}
