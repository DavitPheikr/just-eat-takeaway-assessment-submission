import { useEffect, useMemo, useState } from "react";
import { Check, MapPin, Star, Pencil, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EMPTY_FILTERS,
  normalizeFilters,
  type SavedFilters,
  type TriState,
} from "@/lib/savedFilters";

interface Props {
  open: boolean;
  /** Distinct postcodes to offer in the postcode picker. */
  postcodes: string[];
  /** The currently-applied filters (used as the initial draft when opening). */
  value: SavedFilters;
  onClose: () => void;
  onApply: (next: SavedFilters) => void;
}

const TRI_OPTIONS: { value: TriState; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/**
 * Bottom-sheet filter editor. Edits a draft locally and only commits on Apply,
 * so navigating away with Esc / scrim-tap discards in-progress changes.
 *
 * Keyboard:
 *   - Esc      → close (discard draft)
 *   - Enter    → apply draft
 *   - Cmd/Ctrl+Backspace → reset draft to "no filters"
 */
export function SavedFilterSheet({ open, postcodes, value, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<SavedFilters>(value);

  // Reset the draft from `value` whenever the sheet opens. (We intentionally
  // do NOT sync while open — the user is editing a local draft.)
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  // If the postcode list changes while the sheet is open and the draft's
  // selected postcode disappears (item removed), drop it.
  useEffect(() => {
    if (!open) return;
    if (draft.postcode !== null && !postcodes.includes(draft.postcode)) {
      setDraft((d) => ({ ...d, postcode: null }));
    }
  }, [open, postcodes, draft.postcode]);

  const normalizedDraft = useMemo(() => normalizeFilters(draft), [draft]);

  const apply = () => {
    onApply(normalizedDraft);
    onClose();
  };
  const reset = () => setDraft(EMPTY_FILTERS);

  // Keyboard shortcuts. We deliberately do NOT bind plain Enter globally —
  // letting Enter fall through to native button activation means keyboard
  // users can toggle chips / Tri-toggles / Reset / Cancel without accidentally
  // applying and closing the sheet. Apply is reachable via Tab → Enter on the
  // Apply button, and via Cmd/Ctrl+Enter as an explicit power-user shortcut.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        apply();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, normalizedDraft]);

  // Whether rating/review "yes" should be visually disabled because visited="no".
  const ratingReviewDisabledByVisited = draft.visited === "no";

  return (
    <>
      {/* Scrim */}
      <button
        type="button"
        aria-hidden={!open}
        tabIndex={-1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-[1700] bg-black/40 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filter saved restaurants"
        aria-hidden={!open}
        className={cn(
          "absolute inset-x-0 bottom-0 z-[1800] flex max-h-[85%] flex-col rounded-t-[28px] border-t border-border bg-surface shadow-2xl transition-transform duration-300 ease-out-soft",
          open
            ? "translate-y-0 pointer-events-auto visible"
            : "translate-y-full pointer-events-none invisible",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2">
          <span className="h-1.5 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-ink">Filters</h2>
            <p className="text-xs text-ink-muted">
              Esc to close · ⌘/Ctrl+Enter to apply
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-3 pt-1">
          {/* Postcode */}
          <FilterGroup icon={<MapPin className="h-4 w-4" />} label="Saved from postcode">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                active={draft.postcode === null}
                onClick={() => setDraft((d) => ({ ...d, postcode: null }))}
              >
                Any
              </Chip>
              {postcodes.map((pc) => (
                <Chip
                  key={pc}
                  active={draft.postcode === pc}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      postcode: d.postcode === pc ? null : pc,
                    }))
                  }
                >
                  {pc}
                </Chip>
              ))}
              {postcodes.length === 0 && (
                <p className="text-xs text-ink-muted">No saved postcodes yet.</p>
              )}
            </div>
          </FilterGroup>

          {/* Visited */}
          <FilterGroup icon={<CheckCircle2 className="h-4 w-4" />} label="Visited">
            <TriToggle
              value={draft.visited}
              onChange={(visited) => setDraft((d) => ({ ...d, visited }))}
            />
          </FilterGroup>

          {/* Has rating */}
          <FilterGroup
            icon={<Star className="h-4 w-4" />}
            label="Has your rating"
            hint={
              ratingReviewDisabledByVisited
                ? "Only visited places can have a rating."
                : undefined
            }
          >
            <TriToggle
              value={draft.hasRating}
              disabledValues={ratingReviewDisabledByVisited ? ["yes"] : []}
              onChange={(hasRating) => setDraft((d) => ({ ...d, hasRating }))}
            />
          </FilterGroup>

          {/* Has review */}
          <FilterGroup
            icon={<Pencil className="h-4 w-4" />}
            label="Has your note"
            hint={
              ratingReviewDisabledByVisited
                ? "Only visited places can have a note."
                : undefined
            }
          >
            <TriToggle
              value={draft.hasReview}
              disabledValues={ratingReviewDisabledByVisited ? ["yes"] : []}
              onChange={(hasReview) => setDraft((d) => ({ ...d, hasReview }))}
            />
          </FilterGroup>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3">
          <Button type="button" variant="ghost" onClick={reset}>
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ───────────────────────────── primitives ─────────────────────────────

function FilterGroup({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        <span className="text-ink">{icon}</span>
        {label}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-surface text-ink hover:bg-surface-muted",
      )}
    >
      {active && <Check className="h-3 w-3" strokeWidth={3} />}
      {children}
    </button>
  );
}

function TriToggle({
  value,
  onChange,
  disabledValues = [],
}: {
  value: TriState;
  onChange: (v: TriState) => void;
  disabledValues?: TriState[];
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full border border-border p-0.5">
      {TRI_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const disabled = disabledValues.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-w-[56px] rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-ink hover:bg-surface-muted",
              disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
