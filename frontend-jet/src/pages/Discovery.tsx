import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Pippo } from "@/components/Pippo";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { MapRegion } from "@/components/discovery/MapRegion";
import { CardStackRegion } from "@/components/discovery/CardStackRegion";
import { PostcodeSwitcher } from "@/components/discovery/PostcodeSwitcher";
import { useDiscovery } from "@/lib/api/useDiscovery";
import {
  useCreateSaved,
  useDeleteSaved,
  useSavedList,
  useSavedRestaurantMap,
} from "@/lib/api/useSaved";
import { genericErrorMessage, postcodeErrorMessage } from "@/lib/errors";
import { getLastPostcode, setLastPostcode } from "@/lib/lastPostcode";
import { toast } from "@/hooks/use-toast";

export default function Discovery() {
  const [params] = useSearchParams();
  const postcode = params.get("postcode");
  const { data, isPending, isError, error, refetch, isRefetching } = useDiscovery(postcode);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // Saved-state wiring: load once so bookmark icons reflect server truth.
  useSavedList();
  const savedMap = useSavedRestaurantMap();
  const createSaved = useCreateSaved();
  const deleteSaved = useDeleteSaved();

  // Persist the active postcode so returning to /discover (e.g. from Saved)
  // resumes where the user left off without prompting again.
  useEffect(() => {
    if (postcode) setLastPostcode(postcode);
  }, [postcode]);

  // Initialize focused restaurant to the first one when data arrives.
  useEffect(() => {
    if (data?.restaurants.length && !focusedId) {
      setFocusedId(data.restaurants[0].id);
    }
  }, [data, focusedId]);

  // Reset focus when postcode changes.
  useEffect(() => {
    setFocusedId(null);
  }, [postcode]);

  // Arrow up / down → move focus to the prev / next restaurant card.
  // The CardStackRegion's focus effect handles the smooth scroll.
  useEffect(() => {
    const list = data?.restaurants;
    if (!list || list.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      // Don't hijack arrows when typing into an input/textarea.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      e.preventDefault();
      const idx = focusedId ? list.findIndex((r) => r.id === focusedId) : -1;
      const safeIdx = idx < 0 ? 0 : idx;
      const nextIdx =
        e.key === "ArrowDown"
          ? Math.min(list.length - 1, safeIdx + 1)
          : Math.max(0, safeIdx - 1);
      if (list[nextIdx] && list[nextIdx].id !== focusedId) {
        setFocusedId(list[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, focusedId]);

  // No postcode in URL → fall back to the most recently used one if we have it.
  if (!postcode) {
    const remembered = getLastPostcode();
    if (remembered) {
      return <Navigate to={`/discover?postcode=${encodeURIComponent(remembered)}`} replace />;
    }
    return <NoPostcode />;
  }

  const handleSaveToggle = (restaurantId: string) => {
    const existing = savedMap.get(restaurantId);
    if (existing) {
      deleteSaved.mutate(
        { savedId: existing.id },
        {
          onError: (err) => {
            toast({
              title: "Couldn’t unsave",
              description: genericErrorMessage(err.kind),
              variant: "destructive",
            });
          },
        },
      );
    } else {
      createSaved.mutate(
        { restaurantId, savedFromPostcode: postcode },
        {
          onSuccess: () => {
            setCelebrate(true);
          },
          onError: (err) => {
            toast({
              title: "Couldn’t save",
              description: genericErrorMessage(err.kind),
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
      {/* Top half — map */}
      <div className="relative h-[40%] min-h-[200px] w-full">
        <MapRegion
          restaurants={data?.restaurants ?? []}
          focusedId={focusedId}
          onMarkerClick={setFocusedId}
        />
        {/* Postcode switcher — overlays the map so it doesn't steal vertical space. */}
        <div className="absolute left-3 top-3 z-[1200]">
          <PostcodeSwitcher current={postcode} />
        </div>
      </div>

      {/* Bottom half — card stack / state surfaces */}
      <div className="mt-3 flex-1 overflow-hidden">
        {isPending || isRefetching ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={postcodeErrorMessage(error?.kind ?? "UNKNOWN")} onRetry={refetch} />
        ) : !data || data.restaurants.length === 0 ? (
          <EmptyState postcode={postcode} />
        ) : (
          <CardStackRegion
            restaurants={data.restaurants}
            focusedId={focusedId}
            onFocus={setFocusedId}
            onSaveToggle={handleSaveToggle}
            savedRestaurantIds={new Set(savedMap.keys())}
          />
        )}
      </div>

      <CelebrationOverlay open={celebrate} onDismiss={() => setCelebrate(false)} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Pippo state="loading" size="md" />
      <p className="text-sm text-ink-muted">Finding restaurants…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Pippo state="sad" size="md" />
      <p className="text-sm font-medium text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ postcode }: { postcode: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Pippo state="sad" size="md" />
      <p className="text-sm text-ink">
        No restaurants near <span className="font-semibold text-brand-ink">{postcode}</span>.
      </p>
      <Link
        to="/"
        className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
      >
        Try another postcode →
      </Link>
    </div>
  );
}

function NoPostcode() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6 text-center pb-[calc(56px+env(safe-area-inset-bottom))]">
      <Pippo state="greeting" size="lg" />
      <p className="text-sm text-ink">Enter a postcode to start discovering.</p>
      <Link
        to="/"
        className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground"
      >
        Enter postcode
      </Link>
    </div>
  );
}
