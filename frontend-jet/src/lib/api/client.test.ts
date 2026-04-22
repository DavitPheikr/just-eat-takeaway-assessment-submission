import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./client";
import { searchDiscovery } from "./endpoints";

const fetchMock = vi.fn();

describe("discovery api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the relative discovery path by default", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ postcode: "EC4M7RF", restaurants: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await searchDiscovery("EC4M7RF");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/discovery/search?postcode=EC4M7RF",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses VITE_API_BASE_URL when configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000/");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ postcode: "EC4M7RF", restaurants: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await searchDiscovery("EC4M7RF");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/discovery/search?postcode=EC4M7RF",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("maps shaped backend errors to ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_POSTCODE",
            message: "Postcode could not be validated by upstream.",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(apiFetch("/discovery/search", { query: { postcode: "INVALID" } })).rejects.toMatchObject({
      kind: "INVALID_POSTCODE",
      status: 400,
      code: "INVALID_POSTCODE",
    } satisfies Partial<ApiError>);
  });
});
