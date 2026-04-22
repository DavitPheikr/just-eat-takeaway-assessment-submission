import { NavLink, useLocation } from "react-router-dom";
import { Compass, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/discover", label: "Discover", Icon: Compass },
  { to: "/saved", label: "Saved", Icon: Bookmark },
] as const;

const HIDDEN_ON = ["/"];

export function BottomTabBar() {
  const { pathname } = useLocation();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="absolute inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[56px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors",
                  isActive ? "text-brand" : "text-ink-muted hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn("h-6 w-6 transition-transform", isActive && "scale-110")}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
