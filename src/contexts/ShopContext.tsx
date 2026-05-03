/**
 * ShopContext.tsx
 *
 * Provides shopId, currentMember (role, name) to the entire app.
 * Also exposes permission helpers so components can gate UI elements.
 *
 * Usage:
 *   const { shopId, member, can } = useShop();
 *   if (can.delete) <DeleteButton />
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthChange } from "@/lib/authService";
import {
  getShopInfoForUser,
  type ShopMember,
  type MemberRole,
  canDelete,
  canManageMembers,
  canAccessSettings,
  canExportData,
} from "@/lib/membershipService";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Permissions {
  delete: boolean;
  manageMembers: boolean;
  accessSettings: boolean;
  exportData: boolean;
}

interface ShopContextValue {
  /** The shopId all data lives under. null = not yet resolved. */
  shopId: string | null;
  /** Current user's member record including role. */
  member: ShopMember | null;
  /** Pre-computed permission flags. */
  can: Permissions;
  /** True while resolving membership from Firestore. */
  loading: boolean;
  /** Call this after joining a shop to refresh context. */
  refresh: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ShopContext = createContext<ShopContextValue>({
  shopId: null,
  member: null,
  can: { delete: false, manageMembers: false, accessSettings: false, exportData: false },
  loading: true,
  refresh: async () => {},
});

export function useShop(): ShopContextValue {
  return useContext(ShopContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ShopProvider({ children }: { children: ReactNode }) {
  const [shopId, setShopId] = useState<string | null>(null);
  const [member, setMember] = useState<ShopMember | null>(null);
  const [loading, setLoading] = useState(true);

  const resolve = useCallback(async (uid: string | null) => {
    if (!uid) {
      setShopId(null);
      setMember(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const info = await getShopInfoForUser(uid);
      if (info) {
        setShopId(info.shopId);
        setMember(info.member);
      } else {
        setShopId(null);
        setMember(null);
      }
    } catch {
      setShopId(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-resolve whenever auth state changes
  useEffect(() => {
    const unsub = onAuthChange((user) => resolve(user?.uid ?? null));
    return unsub;
  }, [resolve]);

  const refresh = useCallback(async () => {
    const { getCurrentUser } = await import("@/lib/authService");
    await resolve(getCurrentUser()?.uid ?? null);
  }, [resolve]);

  const role: MemberRole = member?.role ?? "staff";
  const can: Permissions = {
    delete: canDelete(role),
    manageMembers: canManageMembers(role),
    accessSettings: canAccessSettings(role),
    exportData: canExportData(role),
  };

  return (
    <ShopContext.Provider value={{ shopId, member, can, loading, refresh }}>
      {children}
    </ShopContext.Provider>
  );
}
