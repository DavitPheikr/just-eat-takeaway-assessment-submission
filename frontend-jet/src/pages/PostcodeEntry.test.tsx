import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { DiscoveryResponse } from "@/lib/api/types";
import PostcodeEntry from "./PostcodeEntry";

const navigateMock = vi.fn();
const searchDiscoveryMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/lib/api/endpoints", () => ({
  searchDiscovery: (...args: unknown[]) => searchDiscoveryMock(...args),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PostcodeEntry />
    </QueryClientProvider>,
  );
}

describe("PostcodeEntry", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    searchDiscoveryMock.mockReset();
  });

  it("keeps Go disabled until the user enters a postcode", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
  });

  it("does not search while typing and submits the normalized postcode on Go", async () => {
    const response: DiscoveryResponse = {
      postcode: "EC4M7RF",
      restaurants: [
        {
          id: "rest-1",
          externalRestaurantId: "ext-1",
          name: "Test Kitchen",
          cuisines: ["Pizza"],
          rating: 4.5,
          addressText: "1 Fleet Place, London",
          latitude: 51.51,
          longitude: -0.10,
          minimumOrderPence: 1500,
          deliveryEtaMinutes: 25,
          openNow: true,
        },
      ],
    };
    searchDiscoveryMock.mockResolvedValue(response);

    renderPage();

    const input = screen.getByLabelText("Postcode");
    fireEvent.change(input, { target: { value: "ec4m 7rf" } });

    expect(searchDiscoveryMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Go" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => {
      expect(searchDiscoveryMock).toHaveBeenCalledWith("EC4M7RF", expect.any(AbortSignal));
    });
    expect(navigateMock).toHaveBeenCalledWith("/discover?postcode=EC4M7RF");
  });

  it("shows a clean postcode error when discovery fails", async () => {
    searchDiscoveryMock.mockRejectedValue(
      new ApiError("INVALID_POSTCODE", 400, "Upstream rejected postcode", "INVALID_POSTCODE"),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText("Postcode"), { target: { value: "INVALID" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await screen.findByRole("alert");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn’t recognise that postcode. Try another one.",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
