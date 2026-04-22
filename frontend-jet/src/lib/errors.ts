import type { ApiErrorKind } from "./api/types";

/**
 * Map a frontend ApiErrorKind to a user-friendly, retry-safe message.
 * Never expose raw backend `error.message` strings to the user.
 */
export function postcodeErrorMessage(kind: ApiErrorKind): string {
  switch (kind) {
    case "INVALID_POSTCODE":
      return "We couldn’t recognise that postcode. Try another one.";
    case "VALIDATION":
      return "That doesn’t look like a valid postcode. Try again.";
    case "UPSTREAM_UNAVAILABLE":
      return "Our restaurant source is unreachable. Try again in a moment.";
    case "INTERNAL_ERROR":
      return "Something went wrong on our end. Please try again.";
    case "NETWORK":
      return "Can’t reach the network. Check your connection and retry.";
    case "NOT_FOUND":
    case "UNKNOWN":
    default:
      return "Something didn’t work. Please try again.";
  }
}

/** Generic error message for non-postcode flows (saved CRUD, etc.). */
export function genericErrorMessage(kind: ApiErrorKind): string {
  switch (kind) {
    case "NETWORK":
      return "Can’t reach the network. Check your connection and try again.";
    case "NOT_FOUND":
      return "That item is no longer available.";
    case "VALIDATION":
      return "That request wasn’t accepted. Please try again.";
    case "UPSTREAM_UNAVAILABLE":
      return "Service is temporarily unavailable. Try again in a moment.";
    case "INTERNAL_ERROR":
      return "Something went wrong on our end. Please try again.";
    case "UNKNOWN":
    default:
      return "Something didn’t work. Please try again.";
  }
}

/** Cosmetic normalization for display + cache-key parity with backend. */
export function normalizePostcode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
