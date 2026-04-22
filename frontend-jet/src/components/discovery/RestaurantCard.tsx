import { Bookmark, Star, Clock, Wallet, Circle, MapPin } from "lucide-react";
import type { Restaurant } from "@/lib/api/types";
import { formatEta, formatMinimumOrder, formatOpenStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RestaurantCardProps {
  restaurant: Restaurant;
  focused?: boolean;
  onOpen?: (id: string) => void;
  onSaveToggle?: (id: string) => void;
  saved?: boolean;
}

/**
 * Discovery card — dense, intentional composition.
 * Required fields (always visible): name, cuisines, rating, addressText.
 * Optional metadata (null-safe): openNow, deliveryEtaMinutes, minimumOrderPence
 * — rendered as a single compact pill row at the bottom.
 */
export function RestaurantCard({
  restaurant,
  focused = false,
  onOpen,
  onSaveToggle,
  saved = false,
}: RestaurantCardProps) {
  const minOrder = formatMinimumOrder(restaurant.minimumOrderPence);
  const eta = formatEta(restaurant.deliveryEtaMinutes);
  const openStatus = formatOpenStatus(restaurant.openNow);
  const hasMeta = !!(eta || minOrder || openStatus);

  return (
    <article
      aria-label={restaurant.name}
      className={cn(
        "relative flex h-full w-full overflow-hidden rounded-card border bg-surface shadow-sm transition-all",
        focused ? "border-brand/60 shadow-md" : "border-border",
      )}
    >
      {/* Card body */}
      <button
        type="button"
        onClick={() => onOpen?.(restaurant.id)}
        className="flex min-w-0 flex-1 flex-col items-stretch gap-2.5 p-5 text-left"
      >
        {/* Cuisines + rating */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="min-w-0 flex-1 basis-[70%]">
            <p className="line-clamp-2 text-[11px] font-semibold uppercase leading-tight tracking-wide text-ink-muted">
              {restaurant.cuisines.length > 0 ? restaurant.cuisines.slice(0, 4).join(" • ") : "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-sm font-semibold text-ink">
            <Star className="h-3.5 w-3.5 fill-brand text-brand" strokeWidth={0} />
            {restaurant.rating.toFixed(1)}
          </div>
        </div>

        {/* Name — clamp to 2 lines, scale down on small heights */}
        <h3 className="line-clamp-2 break-words font-display text-2xl font-bold leading-[1.15] text-ink sm:text-3xl">
          {restaurant.name}
        </h3>

        {/* Address — single line so meta row always fits */}
        <p className="flex min-w-0 items-start gap-1.5 text-sm text-ink-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="line-clamp-1 min-w-0 flex-1">{restaurant.addressText}</span>
        </p>

        {/* Optional metadata pill row — pushed to the bottom */}
        {hasMeta && (
          <ul className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            {openStatus && (
              <li
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium",
                  restaurant.openNow
                    ? "bg-success/10 text-success"
                    : "bg-surface-muted text-ink-muted",
                )}
              >
                <Circle
                  className={cn(
                    "h-2 w-2",
                    restaurant.openNow ? "fill-success text-success" : "fill-ink-muted text-ink-muted",
                  )}
                  strokeWidth={0}
                />
                {openStatus}
              </li>
            )}
            {eta && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-ink-muted">
                <Clock className="h-3.5 w-3.5" />
                {eta}
              </li>
            )}
            {minOrder && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-ink-muted">
                <Wallet className="h-3.5 w-3.5" />
                {minOrder}
              </li>
            )}
          </ul>
        )}
      </button>

      {/* Save action zone */}
      <div className="flex w-12 flex-col items-center justify-start border-l border-border bg-surface-muted/60 pt-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSaveToggle?.(restaurant.id);
          }}
          aria-label={saved ? "Unsave" : "Save"}
          aria-pressed={saved}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
            saved ? "text-brand" : "text-ink-muted hover:text-ink",
          )}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        </button>
      </div>
    </article>
  );
}
