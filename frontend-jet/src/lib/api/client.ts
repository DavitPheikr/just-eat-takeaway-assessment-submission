import type { ApiErrorBody, ApiErrorKind } from "./types";

export const API_BASE = "/api/v1";

function getRequestBase(): string {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configuredBase) return API_BASE;
  return `${configuredBase.replace(/\/+$/, "")}${API_BASE}`;
}

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  code?: string;

  constructor(kind: ApiErrorKind, status: number, message: string, code?: string) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

function categorize(status: number, body: ApiErrorBody | null): ApiErrorKind {
  if (status === 422) return "VALIDATION";
  if (status === 404) return "NOT_FOUND";
  if (status === 502) return "UPSTREAM_UNAVAILABLE";
  if (status === 500) return "INTERNAL_ERROR";
  if (status === 409) return "VALIDATION";
  if (status === 400) {
    if (body?.error?.code === "INVALID_POSTCODE") return "INVALID_POSTCODE";
    return "VALIDATION";
  }
  return "UNKNOWN";
}

interface RequestOpts {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined | null>;
}

function buildUrl(path: string, query?: RequestOpts["query"]): string {
  const url = `${getRequestBase()}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiFetch<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, signal, query } = opts;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    throw new ApiError("NETWORK", 0, e instanceof Error ? e.message : "Network error");
  }

  if (res.ok) {
    // 204 No Content guard
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  let parsed: ApiErrorBody | null = null;
  try {
    parsed = (await res.json()) as ApiErrorBody;
  } catch {
    parsed = null;
  }
  const kind = categorize(res.status, parsed);
  const message = parsed?.error?.message ?? res.statusText ?? "Request failed";
  throw new ApiError(kind, res.status, message, parsed?.error?.code);
}
