import { useEffect } from "react";
import { Pippo } from "@/components/Pippo";
import { cn } from "@/lib/utils";

interface CelebrationOverlayProps {
  open: boolean;
  message?: string;
  onDismiss: () => void;
  /** Auto-dismiss duration in ms. Set to 0 to disable. */
  durationMs?: number;
}

/**
 * Lightweight celebratory flash: dims the screen and pops the celebrating
 * Pippo with a short message. Auto-dismisses after `durationMs`. Lives inside
 * the AppShell viewport (absolute, not portal) so it respects the phone frame.
 */
export function CelebrationOverlay({
  open,
  message = "Saved!",
  onDismiss,
  durationMs = 1400,
}: CelebrationOverlayProps) {
  useEffect(() => {
    if (!open || durationMs <= 0) return;
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onDismiss]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "pointer-events-none absolute inset-0 z-[1500] flex items-center justify-center transition-opacity duration-200",
        open ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "relative flex flex-col items-center gap-3 rounded-card bg-surface px-8 py-6 shadow-2xl transition-transform duration-300",
          open ? "scale-100" : "scale-90",
        )}
      >
        <Pippo state="celebrating" size="lg" />
        <p className="font-display text-lg font-bold text-ink">{message}</p>
      </div>
    </div>
  );
}
