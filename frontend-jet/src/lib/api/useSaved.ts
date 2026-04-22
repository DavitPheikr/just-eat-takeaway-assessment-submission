import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSaved, deleteSaved, listSaved, updateSaved } from "@/lib/api/endpoints";
import type { ListSavedParams } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type {
  SavedCreateRequest,
  SavedItem,
  SavedListResponse,
  SavedUpdateRequest,
} from "@/lib/api/types";
import { EMPTY_FILTERS, type SavedFilters } from "@/lib/savedFilters";

export const SAVED_QUERY_KEY = ["saved"] as const;

function paramsFromFilters(filters: SavedFilters): ListSavedParams {
  const params: ListSavedParams = {};
  if (filters.postcode) params.savedFromPostcode = filters.postcode;
  if (filters.visited !== "any") params.visited = filters.visited === "yes";
  if (filters.hasRating !== "any") params.hasUserRating = filters.hasRating === "yes";
  if (filters.hasReview !== "any") params.hasReviewText = filters.hasReview === "yes";
  return params;
}

/**
 * List saved restaurants. Filters are sent as query params and included in
 * the query key so each combination is cached independently.
 *
 * `rawData` is the unfiltered list, used by the filter sheet to populate
 * options (e.g. distinct postcodes). Only fetched when filters are active.
 */
export function useSavedList(filters: SavedFilters = EMPTY_FILTERS) {
  const params = paramsFromFilters(filters);
  const hasParams = Object.keys(params).length > 0;

  const query = useQuery<SavedListResponse, ApiError>({
    queryKey: [...SAVED_QUERY_KEY, params],
    queryFn: ({ signal }) => listSaved(params, signal),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });

  const rawQuery = useQuery<SavedListResponse, ApiError>({
    queryKey: [...SAVED_QUERY_KEY, {}],
    queryFn: ({ signal }) => listSaved({}, signal),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
    enabled: hasParams,
  });

  return {
    ...query,
    rawData: hasParams ? rawQuery.data : query.data,
  };
}

/**
 * Create a saved entry. The server returns a minimal item, so we invalidate
 * the list to backfill snapshot fields (name, cuisines, rating, address).
 */
export function useCreateSaved() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, SavedCreateRequest>({
    mutationFn: (body) => createSaved(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SAVED_QUERY_KEY });
    },
  });
}

/**
 * Apply a producer to every cached saved-list variant. Returns a snapshot
 * for rollback. Needed because the saved query is keyed by filter params.
 */
function mutateAllSavedCaches(
  qc: ReturnType<typeof useQueryClient>,
  producer: (items: SavedItem[]) => SavedItem[],
): Array<[readonly unknown[], SavedListResponse]> {
  const snapshot: Array<[readonly unknown[], SavedListResponse]> = [];
  const entries = qc.getQueriesData<SavedListResponse>({ queryKey: SAVED_QUERY_KEY });
  for (const [key, data] of entries) {
    if (!data) continue;
    snapshot.push([key, data]);
    qc.setQueryData<SavedListResponse>(key, { items: producer(data.items) });
  }
  return snapshot;
}

function restoreSavedCaches(
  qc: ReturnType<typeof useQueryClient>,
  snapshot: Array<[readonly unknown[], SavedListResponse]>,
) {
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
}

/** Update visited / reviewText with optimistic patch + rollback. */
export function useUpdateSaved() {
  const qc = useQueryClient();
  return useMutation<
    SavedItem,
    ApiError,
    { savedId: string; patch: SavedUpdateRequest },
    { snapshot: Array<[readonly unknown[], SavedListResponse]> }
  >({
    mutationFn: ({ savedId, patch }) => updateSaved(savedId, patch),
    onMutate: async ({ savedId, patch }) => {
      await qc.cancelQueries({ queryKey: SAVED_QUERY_KEY });
      const nowIso = new Date().toISOString();
      const snapshot = mutateAllSavedCaches(qc, (items) =>
        items.map((it) =>
          it.id === savedId
            ? {
                ...it,
                ...(patch.visited !== undefined ? { visited: patch.visited } : {}),
                ...(patch.visited !== undefined
                  ? { visitedAt: patch.visited ? it.visitedAt ?? nowIso : null }
                  : {}),
                ...(patch.reviewText !== undefined ? { reviewText: patch.reviewText } : {}),
                ...(patch.userRating !== undefined ? { userRating: patch.userRating } : {}),
              }
            : it,
        ),
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreSavedCaches(qc, ctx.snapshot);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SAVED_QUERY_KEY });
    },
  });
}

/** Delete saved entry with optimistic remove + rollback. */
export function useDeleteSaved() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    ApiError,
    { savedId: string },
    { snapshot: Array<[readonly unknown[], SavedListResponse]> }
  >({
    mutationFn: ({ savedId }) => deleteSaved(savedId),
    onMutate: async ({ savedId }) => {
      await qc.cancelQueries({ queryKey: SAVED_QUERY_KEY });
      const snapshot = mutateAllSavedCaches(qc, (items) =>
        items.filter((it) => it.id !== savedId),
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreSavedCaches(qc, ctx.snapshot);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SAVED_QUERY_KEY });
    },
  });
}

/** Map of restaurantId → SavedItem from the cached saved list. */
export function useSavedRestaurantMap(): Map<string, SavedItem> {
  const { data } = useSavedList();
  const map = new Map<string, SavedItem>();
  data?.items.forEach((it) => map.set(it.restaurantId, it));
  return map;
}
