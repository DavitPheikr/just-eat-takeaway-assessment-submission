/** Persist the last-used postcode so Discovery can resume after navigation. */
const KEY = "chefpick.lastPostcode";

export function getLastPostcode(): string | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setLastPostcode(postcode: string): void {
  try {
    window.localStorage.setItem(KEY, postcode);
  } catch {
    /* ignore */
  }
}

export function clearLastPostcode(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
