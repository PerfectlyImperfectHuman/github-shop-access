/**
 * ModeGuard.tsx
 *
 * Protects a route by checking whether the current mode grants access.
 * If the route is not allowed, the user is silently redirected to "/".
 *
 * Usage in App.tsx:
 *   <Route path="/reports" element={<ModeGuard><Reports /></ModeGuard>} />
 *
 * Design decision — redirect vs. "not authorised" page:
 *   For non-technical shopkeepers a 403-style page is confusing.
 *   A silent redirect to Dashboard is far friendlier. The feature simply
 *   doesn't exist from the user's perspective (it's hidden from nav too).
 *   If you ever want a visible fallback, swap <Navigate> for a custom component.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useMode } from "@/contexts/ModeContext";
import { isRouteAllowed } from "@/lib/modeConfig";
import type { ReactNode } from "react";

interface ModeGuardProps {
  children: ReactNode;
}

export function ModeGuard({ children }: ModeGuardProps) {
  const { mode, isLoading } = useMode();
  const location = useLocation();

  // While mode is being loaded from DB, render nothing to avoid flicker.
  // This is only a brief IndexedDB read — typically <20ms.
  if (isLoading) return null;

  if (!isRouteAllowed(location.pathname, mode)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
