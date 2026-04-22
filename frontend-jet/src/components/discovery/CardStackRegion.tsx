import { useEffect, useRef, useState } from "react";
import type { Restaurant } from "@/lib/api/types";
import { RestaurantCard } from "./RestaurantCard";

interface CardStackRegionProps {
  restaurants: Restaurant[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onOpen?: (id: string) => void;
  onSaveToggle?: (id: string) => void;
  savedRestaurantIds?: Set<string>;
}

/** Px of the next card visible below the focused one (the "peek"). */
const PEEK_PX = 160;
/** Vertical gap between cards. */
const GAP_PX = 20;

/**
 * Vertically scrollable focused-card layout.
 *
 * - One card fills the viewport; the next peeks below to signal scrollability.
 * - Card height is measured via ResizeObserver so it tracks the section size.
 * - IntersectionObserver drives `focusedId` based on which card is currently
 *   in view as the user scrolls.
 * - Tapping a non-focused card scrolls it into view (smooth, snap-aware).
 */
export function CardStackRegion({
  restaurants,
  focusedId,
  onFocus,
  onOpen,
  onSaveToggle,
  savedRestaurantIds,
}: CardStackRegionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [cardHeight, setCardHeight] = useState(0);
  // While set, the IntersectionObserver is muted entirely. Cleared only after
  // scroll has settled (debounced), so intermediate cards passing through the
  // viewport during a smooth scroll cannot clobber focus.
  const programmaticTargetRef = useRef<string | null>(null);
  const scrollSettleTimerRef = useRef<number | null>(null);

  // Measure section height to size each card.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const update = () => setCardHeight(Math.max(0, el.clientHeight - PEEK_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Debounced scroll-settled detector: while a programmatic scroll is in
  // flight, we wait for ~120ms of scroll silence before releasing the guard.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const onScroll = () => {
      if (!programmaticTargetRef.current) return;
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }
      scrollSettleTimerRef.current = window.setTimeout(() => {
        programmaticTargetRef.current = null;
        scrollSettleTimerRef.current = null;
      }, 120);
    };
    section.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      section.removeEventListener("scroll", onScroll);
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current);
        scrollSettleTimerRef.current = null;
      }
    };
  }, []);

  // Track which card is dominantly visible → set as focused. Completely muted
  // while a programmatic scroll is in flight.
  useEffect(() => {
    const root = sectionRef.current;
    if (!root || restaurants.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (programmaticTargetRef.current) return; // muted during programmatic scroll
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.85)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = (visible.target as HTMLElement).dataset.restaurantId;
        if (id) onFocus(id);
      },
      { root, threshold: [0.85, 0.95, 1] },
    );

    itemRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [restaurants, onFocus]);

  // External focus changes (pin click or card click) → scroll the matching
  // card into view. This is the single writer for programmatic card scrolling.
  useEffect(() => {
    if (!focusedId) return;
    const section = sectionRef.current;
    const el = itemRefs.current.get(focusedId);
    if (!section || !el) return;

    const sectionRect = section.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.top - sectionRect.top;
    if (Math.abs(delta) < 4) return; // already aligned

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Arm the guard before scrolling so IO can't fire onFocus mid-animation.
    programmaticTargetRef.current = focusedId;
    const top = section.scrollTop + delta;

    if (prefersReducedMotion) {
      section.scrollTo({ top, behavior: "auto" });
      // No scroll events guaranteed for instant scroll → release synchronously.
      programmaticTargetRef.current = null;
    } else {
      section.scrollTo({ top, behavior: "smooth" });
      // Safety net: even if no scroll events fire (already at target), release.
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }
      scrollSettleTimerRef.current = window.setTimeout(() => {
        programmaticTargetRef.current = null;
        scrollSettleTimerRef.current = null;
      }, 600);
    }
  }, [focusedId]);

  // Card click is a pure focus signal — the external-focus effect handles
  // any scrolling. This avoids competing scroll animations.
  const handleCardClick = (id: string) => {
    if (id !== focusedId) onFocus(id);
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Restaurant card stack"
      className="card-stack relative h-full w-full snap-y snap-mandatory overflow-y-auto px-4 pt-7"
      style={{ paddingBottom: PEEK_PX + 8 }}
    >
      <ul className="flex flex-col">
        {restaurants.map((r, i) => (
          <li
            key={r.id}
            ref={(el) => {
              if (el) itemRefs.current.set(r.id, el);
              else itemRefs.current.delete(r.id);
            }}
            data-restaurant-id={r.id}
            className="flex w-full shrink-0 snap-start"
            style={{
              height: cardHeight || undefined,
              marginBottom: i === restaurants.length - 1 ? 0 : GAP_PX,
            }}
            onClick={() => handleCardClick(r.id)}
          >
            <div className="flex w-full">
              <RestaurantCard
                restaurant={r}
                focused={r.id === focusedId}
                onOpen={onOpen}
                onSaveToggle={onSaveToggle}
                saved={savedRestaurantIds?.has(r.id) ?? false}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
