import { useEffect, useState } from "react";
import { ArrowDownUp, ArrowLeftRight, MapPin, Sparkles } from "lucide-react";
import { Pippo } from "@/components/Pippo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "chefpick:welcome-seen-v1";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface WelcomeOverlayProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: "Welcome to ChefPick",
    body: "Anywhere you go, drop a postcode and see what’s good around you. Quick, no fuss.",
    pippo: "greeting" as const,
    icon: <Sparkles className="h-4 w-4" />,
    chip: "Hello",
  },
  {
    title: "Save what looks good",
    body: "Spotted a place worth trying? Bookmark it. Your saved list travels with you across postcodes.",
    pippo: "greeting" as const,
    icon: <MapPin className="h-4 w-4" />,
    chip: "Save",
  },
  {
    title: "Visit, then weigh in",
    body: "Been there? Mark it visited, give it a rating, and jot a quick note for next time.",
    pippo: "celebrating" as const,
    icon: <ArrowDownUp className="h-4 w-4" />,
    chip: "Rate & remember",
  },
  {
    title: "Getting around",
    body: null,
    pippo: "greeting" as const,
    icon: <ArrowLeftRight className="h-4 w-4" />,
    chip: "Shortcuts",
  },
];

/**
 * First-load welcome experience. Three short panels with a hero Pippo,
 * keyboard shortcuts (← → to switch panels, Enter to advance, Esc to skip).
 * Persists "seen" in localStorage so it only fires once per browser.
 */
export function WelcomeOverlay({ open, onClose }: WelcomeOverlayProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isLast) onClose();
        else setStep((s) => Math.min(STEPS.length - 1, s + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isLast, onClose]);

  const current = STEPS[step];

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden={!open}
        className={cn(
          "absolute inset-0 z-[1900] bg-gradient-to-br from-brand/30 via-black/40 to-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to ChefPick"
        aria-hidden={!open}
        className={cn(
          "absolute inset-x-4 top-1/2 z-[2000] -translate-y-1/2 rounded-[28px] border border-border/60 bg-surface p-6 shadow-2xl transition-all duration-300 ease-out-soft",
          open
            ? "pointer-events-auto visible scale-100 opacity-100"
            : "pointer-events-none invisible scale-95 opacity-0",
        )}
      >
        {/* Chip */}
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-ink">
          {current.icon}
          {current.chip}
        </div>

        {/* Pippo */}
        <div className="flex justify-center">
          <Pippo state={current.pippo} size="lg" />
        </div>

        {/* Copy */}
        <h2 className="mt-3 text-center font-display text-2xl font-extrabold leading-tight text-ink">
          {current.title}
        </h2>

        {current.body && (
          <p className="mx-auto mt-2 max-w-[20rem] text-center text-sm leading-relaxed text-ink-muted">
            {current.body}
          </p>
        )}

        {step === STEPS.length - 1 && (
          <ul className="mt-4 space-y-2.5 text-sm text-ink">
            <ShortcutRow
              icon={<ArrowDownUp className="h-3.5 w-3.5" />}
              label="Browse cards"
              hint="Swipe, scroll, or use ↑ ↓"
            />
            <ShortcutRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Pick from the map"
              hint="Tap a pin to focus that place"
            />
            <ShortcutRow
              icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
              label="Switch tabs"
              hint="Discover ↔ Saved with ← →"
            />
          </ul>
        )}

        {/* Dots */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-brand" : "w-1.5 bg-border hover:bg-ink-muted",
              )}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-ink-muted hover:text-ink"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                if (isLast) onClose();
                else setStep((s) => Math.min(STEPS.length - 1, s + 1));
              }}
              className="min-w-[96px]"
            >
              {isLast ? "Let’s go" : "Next"}
            </Button>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] uppercase tracking-wider text-ink-muted">
          ← → to navigate · Enter to continue · Esc to skip
        </p>
      </div>
    </>
  );
}

function ShortcutRow({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-muted/50 px-3 py-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-ink">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{label}</p>
        <p className="text-xs text-ink-muted">{hint}</p>
      </div>
    </li>
  );
}

