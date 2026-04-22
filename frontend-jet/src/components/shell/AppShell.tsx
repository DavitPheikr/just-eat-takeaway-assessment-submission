import { ReactNode, useEffect, useState } from "react";
import { useTabArrowNav } from "@/hooks/useTabArrowNav";
import { PhoneFrame } from "./PhoneFrame";
import { BottomTabBar } from "./BottomTabBar";

interface AppShellProps {
  children: ReactNode;
}

const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

/** Mounts global keyboard shortcuts that need to live inside the Router. */
function GlobalShortcuts() {
  useTabArrowNav();
  return null;
}

/**
 * AppShell renders edge-to-edge on phones, and inside a CSS iPhone frame
 * on tablet/desktop widths. The bottom tab bar lives at app-shell level
 * so it persists across screens (and is hidden per-route by BottomTabBar).
 */
export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
        <GlobalShortcuts />
        <main className="relative flex-1 overflow-hidden">{children}</main>
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-device-stage p-6">
      <PhoneFrame>
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
          <GlobalShortcuts />
          <main className="relative flex-1 overflow-hidden">{children}</main>
          <BottomTabBar />
        </div>
      </PhoneFrame>
    </div>
  );
}
