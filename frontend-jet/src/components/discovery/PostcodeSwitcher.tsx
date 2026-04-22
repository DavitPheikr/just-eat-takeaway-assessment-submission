import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchDiscovery } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { DiscoveryResponse } from "@/lib/api/types";
import { normalizePostcode, postcodeErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface PostcodeSwitcherProps {
  /** Currently active postcode (already normalized for display). */
  current: string;
}

/**
 * Compact control overlaid on the Discovery map that lets the user switch
 * postcodes without returning to the entry screen. Uses an inline panel rather
 * than a portal popover so Leaflet panes cannot cover or intercept it.
 */
export function PostcodeSwitcher({ current }: PostcodeSwitcherProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(current);
    setError(null);
    const focusTimer = window.setTimeout(() => inputRef.current?.select(), 0);

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, current]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalized = normalizePostcode(value);
    if (!normalized || loading) return;
    if (normalized === current) {
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await queryClient.fetchQuery<DiscoveryResponse>({
        queryKey: ["discovery", normalized],
        queryFn: ({ signal }) => searchDiscovery(normalized, signal),
        staleTime: 5 * 60 * 1000,
      });

      if (data.restaurants.length === 0) {
        setError(`No restaurants near ${data.postcode || normalized}.`);
        setLoading(false);
        return;
      }

      setOpen(false);
      setLoading(false);
      navigate(`/discover?postcode=${encodeURIComponent(normalized)}`);
    } catch (err) {
      const kind = err instanceof ApiError ? err.kind : "UNKNOWN";
      setError(postcodeErrorMessage(kind));
      setLoading(false);
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="postcode-switcher-panel"
        aria-label={`Change postcode (currently ${current})`}
        onClick={() => setOpen((next) => !next)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-md backdrop-blur transition-colors hover:bg-surface"
      >
        <MapPin className="h-3.5 w-3.5 text-brand" />
        <span className="uppercase tracking-wide">{current}</span>
        <Pencil className="h-3 w-3 text-ink-muted" />
      </button>

      {open && (
        <div
          id="postcode-switcher-panel"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-[1200] w-[18rem] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
        >
          <form onSubmit={handleSubmit} className="space-y-2">
            <label htmlFor="switch-postcode" className="text-xs font-semibold text-ink">
              Change postcode
            </label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border bg-surface px-3 py-1 transition-colors",
                error ? "border-destructive/60" : "border-border focus-within:border-brand",
                loading && "opacity-60",
              )}
            >
              <input
                id="switch-postcode"
                ref={inputRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="postal-code"
                spellCheck={false}
                disabled={loading}
                placeholder="e.g. EC4M 7RF"
                className="h-8 flex-1 bg-transparent text-sm font-medium uppercase tracking-wide text-ink placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted focus:outline-none"
                aria-invalid={!!error}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!value.trim() || loading}
                className="h-8 rounded-full px-4 text-xs font-semibold"
              >
                {loading ? "…" : "Go"}
              </Button>
            </div>
            {error ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-[11px] text-ink-muted">
                Try <span className="font-semibold text-ink">EC4M 7RF</span> ·{" "}
                <span className="font-semibold text-ink">SW1A 1AA</span>
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
