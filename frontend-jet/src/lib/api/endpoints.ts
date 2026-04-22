import { apiFetch } from "./client";
import type {
  DiscoveryResponse,
  HealthResponse,
  SavedCreateRequest,
  SavedCreateResponse,
  SavedDeleteResponse,
  SavedItem,
  SavedListResponse,
  SavedUpdateRequest,
} from "./types";

export function getHealth(signal?: AbortSignal) {
  return apiFetch<HealthResponse>("/health", { signal });
}

export function searchDiscovery(postcode: string, signal?: AbortSignal) {
  return apiFetch<DiscoveryResponse>("/discovery/search", {
    query: { postcode },
    signal,
  });
}

/**
 * Filters for listing saved restaurants. `hasUserRating` / `hasReviewText`
 * only match `visited=true` rows; contradictory combinations return [].
 */
export interface ListSavedParams {
  savedFromPostcode?: string;
  visited?: boolean;
  hasUserRating?: boolean;
  hasReviewText?: boolean;
}

export function listSaved(params: ListSavedParams = {}, signal?: AbortSignal) {
  const query: Record<string, string> = {};
  if (params.savedFromPostcode) query.savedFromPostcode = params.savedFromPostcode;
  if (typeof params.visited === "boolean") query.visited = String(params.visited);
  if (typeof params.hasUserRating === "boolean") query.hasUserRating = String(params.hasUserRating);
  if (typeof params.hasReviewText === "boolean") query.hasReviewText = String(params.hasReviewText);
  return apiFetch<SavedListResponse>("/saved", { query, signal });
}

export function createSaved(body: SavedCreateRequest, signal?: AbortSignal) {
  return apiFetch<SavedCreateResponse>("/saved", { method: "POST", body, signal });
}

export function updateSaved(savedId: string, body: SavedUpdateRequest, signal?: AbortSignal) {
  return apiFetch<SavedItem>(`/saved/${encodeURIComponent(savedId)}`, {
    method: "PATCH",
    body,
    signal,
  });
}

export function deleteSaved(savedId: string, signal?: AbortSignal) {
  return apiFetch<SavedDeleteResponse>(`/saved/${encodeURIComponent(savedId)}`, {
    method: "DELETE",
    signal,
  });
}
