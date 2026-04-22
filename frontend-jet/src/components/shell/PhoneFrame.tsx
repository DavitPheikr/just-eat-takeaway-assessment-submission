import { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
}

/**
 * Pure-CSS iPhone-style frame.
 * Used at app-shell level on tablet/desktop only.
 * Bezel/button colors come from semantic device-* tokens.
 */
export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="relative" style={{ width: 390, height: 844 }}>
      {/* Side buttons */}
      <span className="absolute -left-[3px] top-[110px] h-8 w-[3px] rounded-l bg-device-button" />
      <span className="absolute -left-[3px] top-[170px] h-14 w-[3px] rounded-l bg-device-button" />
      <span className="absolute -left-[3px] top-[240px] h-14 w-[3px] rounded-l bg-device-button" />
      <span className="absolute -right-[3px] top-[200px] h-20 w-[3px] rounded-r bg-device-button" />

      {/* Bezel */}
      <div className="relative h-full w-full rounded-[56px] bg-device-bezel p-[10px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
        {/* Inner viewport */}
        <div className="relative h-full w-full overflow-hidden rounded-[46px] bg-background">
          {/* Dynamic island — must sit above any in-app overlay (map panes,
              popovers, sheets) so the camera notch is always visible. */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-[2000] h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-device-bezel" />
          {children}
        </div>
      </div>
    </div>
  );
}
