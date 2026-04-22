import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Tab order for ← → keyboard navigation between primary screens.
 * Matches BottomTabBar visual order.
 */
const TAB_ORDER = ["/discover", "/saved"] as const;

/**
 * Global hook: ← / → switch between primary tabs (Discover ↔ Saved).
 *
 * No-ops when:
 *   - we're not on a tabbed route (e.g. on "/" the hook does nothing).
 *   - focus is in a text input / textarea / contentEditable.
 *   - any modifier key is held (don't fight browser shortcuts).
 *   - any sheet/modal sets `data-blocking="true"` on a body-level element.
 *     (We expose this hook globally; per-page code may also disable it.)
 */
export function useTabArrowNav(): void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    const idx = TAB_ORDER.findIndex((p) => pathname.startsWith(p));
    if (idx < 0) return; // not on a tabbed page

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }

      // Respect any open modal/sheet. We check for role="dialog" elements
      // that are NOT hidden (i.e. currently presented). All our sheets set
      // aria-hidden on their root and toggle it with `open`.
      const openDialog = document.querySelector(
        '[role="dialog"]:not([aria-hidden="true"])',
      );
      if (openDialog) return;

      const next =
        e.key === "ArrowRight"
          ? Math.min(TAB_ORDER.length - 1, idx + 1)
          : Math.max(0, idx - 1);
      if (next === idx) return;

      e.preventDefault();
      // Preserve ?postcode=... when leaving Discover so coming back works.
      const target =
        TAB_ORDER[next] === "/discover" && search ? `/discover${search}` : TAB_ORDER[next];
      navigate(target);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, search, navigate]);
}
