import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Restaurant } from "@/lib/api/types";
import { RestaurantCard } from "./RestaurantCard";

const restaurant: Restaurant = {
  id: "rest-1",
  externalRestaurantId: "ext-1",
  name: "Pasta Corner",
  cuisines: ["Italian", "Pasta"],
  rating: 4.7,
  addressText: "42 Fleet Street, London",
  latitude: 51.514,
  longitude: -0.103,
  minimumOrderPence: 1200,
  deliveryEtaMinutes: 20,
  openNow: true,
};

describe("RestaurantCard", () => {
  it("renders the required discovery fields from the backend contract", () => {
    render(<RestaurantCard restaurant={restaurant} />);

    expect(screen.getByRole("heading", { name: "Pasta Corner" })).toBeInTheDocument();
    expect(screen.getByText("Italian • Pasta")).toBeInTheDocument();
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("42 Fleet Street, London")).toBeInTheDocument();
  });
});
