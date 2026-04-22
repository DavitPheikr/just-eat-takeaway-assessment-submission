/**
 * ChefPick API contract types.
 * Source of truth: /api/v1 contract. Do not drift.
 */

export interface Restaurant {
  id: string;
  externalRestaurantId: string;
  name: string;
  cuisines: string[];
  rating: number;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  minimumOrderPence: number | null;
  deliveryEtaMinutes: number | null;
  openNow: boolean | null;
}

export interface DiscoveryResponse {
  postcode: string;
  restaurants: Restaurant[];
}

export interface SavedItem {
  id: string;
  restaurantId: string;
  name: string;
  cuisines: string[];
  rating: number;
  addressText: string;
  savedFromPostcode: string;
  savedAt: string; // ISO 8601 UTC
  visited: boolean;
  visitedAt: string | null;
  reviewText: string | null;
  /** User's own 1-5 rating. Null if not yet rated. */
  userRating: number | null;
}

export interface SavedListResponse {
  items: SavedItem[];
}

export interface SavedCreateRequest {
  restaurantId: string;
  savedFromPostcode: string;
}

export interface SavedCreateResponse {
  item: {
    id: string;
    restaurantId: string;
    savedFromPostcode: string;
    visited: boolean;
    reviewText: string | null;
  };
}

export interface SavedUpdateRequest {
  visited?: boolean;
  reviewText?: string | null;
  /** User's own 1-5 rating. Pass null to clear. */
  userRating?: number | null;
}

export interface SavedDeleteResponse {
  deleted: true;
}

export interface HealthResponse {
  status: "ok";
}

/** Frontend-categorized error kinds derived from status + error.code. */
export type ApiErrorKind =
  | "INVALID_POSTCODE"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "VALIDATION"
  | "NETWORK"
  | "UNKNOWN";

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}
