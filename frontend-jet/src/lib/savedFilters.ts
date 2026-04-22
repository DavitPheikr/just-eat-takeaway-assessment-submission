import { useSyncExternalStore } from "react";

/**
 * In-memory filter store for the Saved page. State resets on page refresh
 * but persists across in-app navigation while the SPA is loaded.
 */

export type TriState = "any" | "yes" | "no";

export interface SavedFilters {
  postcode: string | null;
  visited: TriState;
  hasRating: TriState;
  hasReview: TriState;
}

export const EMPTY_FILTERS: SavedFilters = {
  postcode: null,
  visited: "any",
  hasRating: "any",
  hasReview: "any",
};

/**
 * Rating and review only exist on visited items. Coerce filter combinations
 * to keep them consistent with that invariant.
 */
export function normalizeFilters(input: SavedFilters): SavedFilters {
  let { postcode, visited, hasRating, hasReview } = input;

  if (hasRating === "yes" || hasReview === "yes") {
    visited = "yes";
  }

  if (visited === "no") {
    if (hasRating === "yes") hasRating = "any";
    if (hasReview === "yes") hasReview = "any";
  }

  return { postcode, visited, hasRating, hasReview };
}

export function isFiltersEmpty(f: SavedFilters): boolean {
  return (
    f.postcode === null &&
    f.visited === "any" &&
    f.hasRating === "any" &&
    f.hasReview === "any"
  );
}

export function activeFilterCount(f: SavedFilters): number {
  let n = 0;
  if (f.postcode !== null) n++;
  if (f.visited !== "any") n++;
  if (f.hasRating !== "any") n++;
  if (f.hasReview !== "any") n++;
  return n;
}

let state: SavedFilters = EMPTY_FILTERS;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getSavedFilters(): SavedFilters {
  return state;
}

export function setSavedFilters(next: SavedFilters): void {
  const normalized = normalizeFilters(next);
  if (
    normalized.postcode === state.postcode &&
    normalized.visited === state.visited &&
    normalized.hasRating === state.hasRating &&
    normalized.hasReview === state.hasReview
  ) {
    return;
  }
  state = normalized;
  emit();
}

export function clearSavedFilters(): void {
  setSavedFilters(EMPTY_FILTERS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSavedFilters(): SavedFilters {
  return useSyncExternalStore(subscribe, getSavedFilters, getSavedFilters);
}
