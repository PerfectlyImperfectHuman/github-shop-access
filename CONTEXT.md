# Bahi — Project Context

## What this is
Pakistani shop management PWA. React + TypeScript + Tailwind + Dexie.js (IndexedDB).
Two modes: Kiryana (simple udhar/khata) and Pro (full POS + inventory).
GitHub: PerfectlyImperfectHuman/shop-management-system
Live: shop-management-software.vercel.app

## Stack
React 18, TypeScript, Tailwind CSS, Dexie.js (IndexedDB - all data stored on device),
React Router 7, Radix UI, Framer Motion, Recharts, Sonner (toasts), Lucide icons

## Key files
- src/lib/db.ts — all database logic (Dexie/IndexedDB)
- src/lib/utils.ts — helpers (formatCurrency, formatDate etc.)
- src/types/index.ts — TypeScript interfaces (Customer, Transaction, Product, Settings)
- src/pages/ — one file per page
- src/components/Layout.tsx — navigation shell, sidebar, bottom nav
- src/components/BarcodeScanner.tsx — camera barcode scanner
- src/App.tsx — routing, first-run check, loading state
- src/index.css — CSS variables / design tokens

## Database (Dexie/IndexedDB - offline, on device)
Tables: customers, transactions, settings, products
Settings id is always "default"
Transaction types: "credit" (udhar), "payment" (wapsi), "sale" (cash sale)

## What's already built
- Customer management with credit limits
- Transaction ledger with running balance
- Barcode scanner (BarcodeDetector API + manual fallback)
- Daily close report with opening cash
- PWA offline support + service worker
- Settings page with dark mode + data export/import
- Product inventory management
- POS sale page with cart
- First-run shop type selector (kiryana vs pro)
- Print receipts (80mm thermal)
- WhatsApp balance message to customer

## Settings object shape
{ id, currency, shopName, ownerName, phone, address, 
  autoBackup, darkMode, language, taxRate, receiptFooter, shopType }

## Pending features (priority order)
1. Urdu/English language toggle
2. Expense tracking in Daily Close
3. Supplier ledger (what shopkeeper owes suppliers)
4. Cloud sync via Supabase
5. 58mm thermal printer CSS mode
6. Daily WhatsApp summary to owner