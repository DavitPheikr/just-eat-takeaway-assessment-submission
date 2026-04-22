/**
 * Null-safe presentation helpers.
 * These return `null` when the source value is null so the UI can omit cleanly.
 */

export function formatMinimumOrder(pence: number | null | undefined): string | null {
  if (pence === null || pence === undefined) return null;
  const pounds = pence / 100;
  return `£${pounds.toFixed(pounds % 1 === 0 ? 0 : 2)} minimum`;
}

export function formatEta(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  return `${minutes} min`;
}

export function formatOpenStatus(openNow: boolean | null | undefined): string | null {
  if (openNow === null || openNow === undefined) return null;
  return openNow ? "Open now" : "Closed";
}
