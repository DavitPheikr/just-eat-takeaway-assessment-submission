import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { Pippo } from "@/components/Pippo";
import { SavedRow } from "@/components/saved/SavedRow";
import { ReviewSheet } from "@/components/saved/ReviewSheet";
import { SavedFilterSheet } from "@/components/saved/SavedFilterSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useDeleteSaved,
  useSavedList,
  useUpdateSaved,
} from "@/lib/api/useSaved";
import type { SavedItem } from "@/lib/api/types";
import { genericErrorMessage } from "@/lib/errors";
import { getLastPostcode } from "@/lib/lastPostcode";
import { toast } from "@/hooks/use-toast";
import {
  activeFilterCount,
  clearSavedFilters,
  isFiltersEmpty,
  setSavedFilters,
  useSavedFilters,
} from "@/lib/savedFilters";

export default function Saved() {
  const filters = useSavedFilters();
  const { data, rawData, isPending, isError, error, refetch } = useSavedList(filters);
  const updateSaved = useUpdateSaved();
  const deleteSaved = useDeleteSaved();
  const [filterOpen, setFilterOpen] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<SavedItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedItem | null>(null);

  const listRef = useRef<HTMLUListElement>(null);

  const items = data?.items ?? [];
  const totalCount = rawData?.items.length ?? 0;
  const filteredCount = items.length;
  const filterCount = activeFilterCount(filters);
  const hasFilters = !isFiltersEmpty(filters);

  // Distinct postcodes available in the current saved set, sorted alphabetically.
  const postcodeOptions = useMemo(() => {
    const set = new Set<string>();
    rawData?.items.forEach((it) => set.add(it.savedFromPostcode));
    return Array.from(set).sort();
  }, [rawData]);

  const handleToggleVisited = (item: SavedItem) => {
    updateSaved.mutate(
      { savedId: item.id, patch: { visited: !item.visited } },
      {
        onError: (err) =>
          toast({
            title: "Couldn’t update",
            description: genericErrorMessage(err.kind),
            variant: "destructive",
          }),
      },
    );
  };

  const handleSaveReview = (value: string | null) => {
    if (!reviewTarget) return;
    const target = reviewTarget;
    // Hard guard: notes are only allowed on visited items. Mirrors the UI rule
    // and prevents any race (e.g. the row was un-visited while the sheet was open).
    if (!target.visited) {
      setReviewTarget(null);
      toast({
        title: "Mark as visited first",
        description: "You can only add a note to places you've visited.",
        variant: "destructive",
      });
      return;
    }
    updateSaved.mutate(
      { savedId: target.id, patch: { reviewText: value } },
      {
        onError: (err) =>
          toast({
            title: "Couldn’t save note",
            description: genericErrorMessage(err.kind),
            variant: "destructive",
          }),
        onSettled: () => setReviewTarget(null),
      },
    );
  };

  const handleRate = (item: SavedItem, value: number | null) => {
    // If we're SETTING a rating (non-null) and the item is visited locally,
    // include `visited: true` in the same patch. This satisfies the backend's
    // RATING_REQUIRES_VISITED rule even if the prior "Mark visited" PATCH is
    // still in-flight (the server might still see visited=false).
    const patch: { userRating: number | null; visited?: boolean } = { userRating: value };
    if (value != null && item.visited) patch.visited = true;
    updateSaved.mutate(
      { savedId: item.id, patch },
      {
        onError: (err) =>
          toast({
            title: "Couldn’t save rating",
            description:
              err.code === "RATING_REQUIRES_VISITED"
                ? "Mark this place as visited before rating it."
                : genericErrorMessage(err.kind),
            variant: "destructive",
          }),
      },
    );
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    deleteSaved.mutate(
      { savedId: target.id },
      {
        onError: (err) =>
          toast({
            title: "Couldn’t remove",
            description: genericErrorMessage(err.kind),
            variant: "destructive",
          }),
      },
    );
    setConfirmDelete(null);
  };

  // If the row backing the review sheet stops being visited (or disappears),
  // close the sheet — notes are only valid for visited rows.
  useEffect(() => {
    if (!reviewTarget) return;
    const latest = items.find((it) => it.id === reviewTarget.id);
    if (!latest || !latest.visited) setReviewTarget(null);
  }, [items, reviewTarget]);

  // Keyboard shortcuts for confirm-delete modal: Esc closes, Enter confirms.
  useEffect(() => {
    if (!confirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmDelete(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!deleteSaved.isPending) handleConfirmDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDelete, deleteSaved.isPending]);

  // Arrow up / down → scroll the saved list by ~one card. No-ops if any
  // sheet/modal is open or focus is in a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (filterOpen || reviewTarget || confirmDelete) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      const list = listRef.current;
      if (!list) return;
      e.preventDefault();
      // Approximate one card = first <li>'s height + the 12px gap (space-y-3).
      const firstItem = list.querySelector("li") as HTMLElement | null;
      const step = firstItem ? firstItem.offsetHeight + 12 : 240;
      list.scrollBy({
        top: e.key === "ArrowDown" ? step : -step,
        behavior: "smooth",
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterOpen, reviewTarget, confirmDelete]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
      <header className="px-6 pb-2 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Saved
            </h1>
            {!isPending && !isError && totalCount > 0 && (
              <p className="mt-1 text-sm text-ink-muted">
                {hasFilters
                  ? `${filteredCount} of ${totalCount} ${totalCount === 1 ? "place" : "places"}`
                  : `${totalCount} ${totalCount === 1 ? "place" : "places"} you’ve bookmarked`}
              </p>
            )}
          </div>
          {!isPending && !isError && totalCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label={
                filterCount > 0
                  ? `Filters (${filterCount} active)`
                  : "Filters"
              }
              className={cn(
                "relative flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                hasFilters
                  ? "border-brand bg-brand text-brand-foreground hover:bg-brand/90"
                  : "border-border bg-surface text-ink hover:bg-surface-muted",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {filterCount > 0 && (
                <span
                  className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-foreground/20 px-1 text-[11px] font-bold leading-none"
                  aria-hidden
                >
                  {filterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={genericErrorMessage(error?.kind ?? "UNKNOWN")} onRetry={refetch} />
      ) : totalCount === 0 ? (
        <EmptyState />
      ) : items.length === 0 ? (
        <FilteredEmptyState onClear={clearSavedFilters} />
      ) : (
        <ul
          ref={listRef}
          aria-label="Saved restaurants"
          className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-2"
        >
          {items.map((item) => (
            <SavedRow
              key={item.id}
              item={item}
              busy={
                (updateSaved.isPending && updateSaved.variables?.savedId === item.id) ||
                (deleteSaved.isPending && deleteSaved.variables?.savedId === item.id)
              }
              onToggleVisited={() => handleToggleVisited(item)}
              onEditReview={() => setReviewTarget(item)}
              onUnsave={() => setConfirmDelete(item)}
              onRate={(value) => handleRate(item, value)}
            />
          ))}
        </ul>
      )}

      <SavedFilterSheet
        open={filterOpen}
        postcodes={postcodeOptions}
        value={filters}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => setSavedFilters(next)}
      />

      <ReviewSheet
        open={!!reviewTarget}
        restaurantName={reviewTarget?.name ?? ""}
        initialValue={reviewTarget?.reviewText ?? null}
        isSaving={updateSaved.isPending}
        onClose={() => setReviewTarget(null)}
        onSave={handleSaveReview}
      />

      {/* Confirm-delete modal — absolutely positioned inside the phone frame
          (NOT a portal) so it stays clipped to the mobile viewport. */}
      <button
        type="button"
        aria-hidden={!confirmDelete}
        tabIndex={-1}
        onClick={() => setConfirmDelete(null)}
        className={cn(
          "absolute inset-0 z-[1700] bg-black/50 transition-opacity",
          confirmDelete
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Remove from Saved"
        aria-hidden={!confirmDelete}
        className={cn(
          "absolute left-1/2 top-1/2 z-[1800] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-2xl transition-all",
          confirmDelete
            ? "pointer-events-auto visible opacity-100 scale-100"
            : "pointer-events-none invisible opacity-0 scale-95",
        )}
      >
        {confirmDelete && (
          <>
            <h2 className="font-display text-lg font-bold text-ink">Remove from Saved?</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {confirmDelete.name} will be removed from your saved list. Your note and
              visited status will be lost.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteSaved.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSaved.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteSaved.isPending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Pippo state="loading" size="md" />
      <p className="text-sm text-ink-muted">Loading your saved places…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Pippo state="sad" size="md" />
      <p className="text-sm font-medium text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState() {
  const remembered = getLastPostcode();
  const to = remembered ? `/discover?postcode=${encodeURIComponent(remembered)}` : "/discover";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <Pippo state="greeting" size="lg" />
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-ink">Nothing saved yet</p>
        <p className="text-sm text-ink-muted">
          Tap the bookmark on any card to save it here.
        </p>
      </div>
      <Link
        to={to}
        className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground"
      >
        Open Discover →
      </Link>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <Pippo state="loading" size="md" />
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-ink">No matches</p>
        <p className="text-sm text-ink-muted">
          No saved places match your current filters.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground"
      >
        Clear filters
      </button>
    </div>
  );
}
