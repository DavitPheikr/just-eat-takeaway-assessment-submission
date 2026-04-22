import { CheckCircle2, MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SavedItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface SavedRowProps {
  item: SavedItem;
  onToggleVisited: () => void;
  onEditReview: () => void;
  onUnsave: () => void;
  onRate: (value: number | null) => void;
  busy?: boolean;
}

/**
 * A single row on the Saved page. Surfaces snapshot fields from the API
 * (name/cuisines/rating/address) plus visited state, savedFromPostcode,
 * the user's own 1-5 rating, and a one-line review preview.
 */
export function SavedRow({
  item,
  onToggleVisited,
  onEditReview,
  onUnsave,
  onRate,
  busy = false,
}: SavedRowProps) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-sm transition-opacity",
        busy && "opacity-60",
      )}
    >
      {/* Top row: name + ratings */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 flex-1 break-words font-display text-lg font-bold leading-tight text-ink">
          {item.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Your rating — on the LEFT, only when set. The brand-tinted pill
              with a ring is the visual cue that this one is "yours". */}
          {item.visited && item.userRating != null && (
            <div
              className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-sm font-semibold text-brand ring-1 ring-inset ring-brand/40"
              title="Your rating"
              aria-label={`Your rating ${item.userRating.toFixed(1)}`}
            >
              <Star className="h-3.5 w-3.5 fill-brand text-brand" strokeWidth={0} />
              {item.userRating.toFixed(1)}
            </div>
          )}
          {/* Restaurant's public rating — on the RIGHT, neutral pill. */}
          <div
            className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-sm font-semibold text-ink"
            title="Restaurant rating"
            aria-label={`Restaurant rating ${item.rating.toFixed(1)}`}
          >
            <Star className="h-3.5 w-3.5 fill-ink text-ink" strokeWidth={0} />
            {item.rating.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Cuisines */}
      {item.cuisines.length > 0 && (
        <p className="line-clamp-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {item.cuisines.join(" · ")}
        </p>
      )}

      {/* Address */}
      <p className="flex min-w-0 items-start gap-1.5 text-sm text-ink-muted">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="line-clamp-2 min-w-0 flex-1">{item.addressText}</span>
      </p>

      {/* Meta pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
          From {item.savedFromPostcode}
        </span>
        {item.visited && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
            Visited{item.visitedAt ? ` · ${formatVisited(item.visitedAt)}` : ""}
          </span>
        )}
      </div>

      {/* Your rating row — only available once visited */}
      {item.visited && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface-muted/30 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Rate it
          </span>
          <StarRater
            value={item.userRating}
            disabled={busy}
            onChange={onRate}
          />
          {item.userRating != null && (
            <button
              type="button"
              onClick={() => onRate(null)}
              disabled={busy}
              className="ml-auto text-xs font-medium text-ink-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="-mb-1 flex items-center justify-between gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onToggleVisited}
          disabled={busy}
          aria-pressed={item.visited}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            item.visited
              ? "bg-success/15 text-success hover:bg-success/20"
              : "bg-surface-muted text-ink hover:bg-surface-muted/70",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          {item.visited ? "Visited" : "Mark visited"}
        </button>

        <div className="flex items-center gap-1">
          {/* Note pencil — only available once visited, mirroring the rating rule. */}
          {item.visited && (
            <button
              type="button"
              onClick={onEditReview}
              disabled={busy}
              aria-label={item.reviewText ? "Edit note" : "Add note"}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onUnsave}
            disabled={busy}
            aria-label="Remove from saved"
            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Review preview — only when visited (matches the rating rule). */}
      {item.visited && item.reviewText && (
        <button
          type="button"
          onClick={onEditReview}
          className="rounded-md border border-border/60 bg-surface-muted/40 px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
        >
          <span className="line-clamp-2">{item.reviewText}</span>
        </button>
      )}
    </li>
  );
}

interface StarRaterProps {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}

/** 1-5 star picker with hover preview. Clicking the currently-selected star clears the rating. */
function StarRater({ value, disabled, onChange }: StarRaterProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label="Your rating"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? null : n)}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={cn(
              "rounded p-0.5 transition-transform hover:scale-110 disabled:opacity-50",
              filled ? "text-brand" : "text-border",
            )}
          >
            <Star
              className={cn("h-4 w-4", filled && "fill-brand")}
              strokeWidth={filled ? 0 : 2}
            />
          </button>
        );
      })}
    </div>
  );
}

function formatVisited(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
