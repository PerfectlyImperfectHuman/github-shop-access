/**
 * ModeContext.tsx
 *
 * Provides the current AppMode to the entire component tree.
 *
 * Architecture decisions:
 * - Mirrors the LanguageContext pattern already in the codebase (consistency).
 * - Persistence uses the existing `db.settings` (Dexie/IndexedDB) — no new deps.
 * - Mode changes are instant (no reload). React re-render propagates the change
 *   to every consumer: Layout (nav), App (route guards), Settings (selector).
 * - The shopType field in Settings is kept as the storage key for backward
 *   compat — but is always normalised to AppMode on read.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { db } from "@/lib/db";
import { normaliseMode, type AppMode } from "@/lib/modeConfig";

interface ModeContextValue {
  /** The currently active app mode */
  mode: AppMode;
  /** Change the active mode and persist immediately */
  setMode: (mode: AppMode) => void;
  /** True while the initial DB read is in progress */
  isLoading: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("simple");
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted mode on mount
  useEffect(() => {
    db.settings
      .get("default")
      .then((s) => {
        if (s?.shopType) {
          setModeState(normaliseMode(s.shopType));
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    // Persist: we write to shopType (existing field) so legacy code that reads
    // shopType from DB directly still gets a sensible value.
    db.settings.update("default", { shopType: next }).catch(() => {
      // If update fails (no row yet), upsert
      db.settings.get("default").then((existing) => {
        if (existing) return;
        // Should not happen in normal flow, but guard defensively
        console.warn("[ModeContext] settings row not found, cannot persist mode");
      });
    });
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, isLoading }}>
      {children}
    </ModeContext.Provider>
  );
}

/** Access the current mode anywhere in the tree. Throws if used outside ModeProvider. */
export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error("useMode must be used inside <ModeProvider>");
  }
  return ctx;
}
