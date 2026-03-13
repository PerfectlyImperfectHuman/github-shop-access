import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Download, Upload, Store } from "lucide-react";
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
    a.download = `shop-backup-${new Date().toISOString().split("T")[0]}.json`;
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
        toast.success("Data imported successfully. Refresh to see changes.");
        window.location.reload();
      } catch {
        toast.error("Invalid backup file");
      }
    };
    input.click();
  }

  if (loading || !settings) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Shop Settings */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSave}
        className="bg-card rounded-xl border border-border p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <Store className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-card-foreground">Shop Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Shop Name", key: "shopName" as const, placeholder: "My Shop" },
            { label: "Owner Name", key: "ownerName" as const, placeholder: "Owner" },
            { label: "Phone", key: "phone" as const, placeholder: "Phone number" },
            { label: "Currency Symbol", key: "currency" as const, placeholder: "₹" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">{f.label}</label>
              <input
                value={settings[f.key]}
                onChange={e => setSettings(s => s ? { ...s, [f.key]: e.target.value } : s)}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">Address</label>
            <input
              value={settings.address}
              onChange={e => setSettings(s => s ? { ...s, address: e.target.value } : s)}
              placeholder="Shop address"
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <button type="submit" className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </motion.form>

      {/* Data Management */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="font-display font-semibold mb-4 text-card-foreground">Data Backup & Restore</h3>
        <p className="text-sm text-muted-foreground mb-4">Export your data as a JSON file for backup, or import a previous backup to restore.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleExport} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
            <Download className="w-4 h-4" /> Export Backup
          </button>
          <button onClick={handleImport} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-warning text-warning-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
            <Upload className="w-4 h-4" /> Import Backup
          </button>
        </div>
      </div>
    </div>
  );
}
