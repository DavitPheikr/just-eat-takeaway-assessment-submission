import { FormEvent, useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Pippo, type PippoState } from "@/components/Pippo";
import { Button } from "@/components/ui/button";
import { searchDiscovery } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { DiscoveryResponse } from "@/lib/api/types";
import { normalizePostcode, postcodeErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  WelcomeOverlay,
  hasSeenWelcome,
  markWelcomeSeen,
} from "@/components/onboarding/WelcomeOverlay";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "no-results"; postcode: string }
  | { kind: "error"; message: string };

type Action =
  | { type: "submit" }
  | { type: "reset" }
  | { type: "no-results"; postcode: string }
  | { type: "error"; message: string };

function reducer(_state: Status, action: Action): Status {
  switch (action.type) {
    case "submit":
      return { kind: "loading" };
    case "reset":
      return { kind: "idle" };
    case "no-results":
      return { kind: "no-results", postcode: action.postcode };
    case "error":
      return { kind: "error", message: action.message };
  }
}

const SUGGESTIONS = ["EC4M 7RF", "SW1A 1AA", "E1 6AN"];

export default function PostcodeEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [status, dispatch] = useReducer(reducer, { kind: "idle" } as Status);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // First-load only: pop the welcome overlay. localStorage-gated.
  useEffect(() => {
    if (!hasSeenWelcome()) setWelcomeOpen(true);
  }, []);

  const closeWelcome = () => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  };

  const trimmed = value.trim();
  const isLoading = status.kind === "loading";
  const isError = status.kind === "error";
  const isNoResults = status.kind === "no-results";

  const goDisabled = !trimmed || isLoading;

  const pippoState: PippoState = isLoading
    ? "loading"
    : isError || isNoResults
    ? "sad"
    : "greeting";

  async function runSearch(raw: string) {
    const normalized = normalizePostcode(raw);
    if (!normalized) return;

    dispatch({ type: "submit" });

    try {
      const data = await queryClient.fetchQuery<DiscoveryResponse>({
        queryKey: ["discovery", normalized],
        queryFn: ({ signal }) => searchDiscovery(normalized, signal),
        staleTime: 5 * 60 * 1000,
      });

      if (data.restaurants.length === 0) {
        dispatch({ type: "no-results", postcode: data.postcode || normalized });
        return;
      }

      navigate(`/discover?postcode=${encodeURIComponent(normalized)}`);
    } catch (err) {
      const kind = err instanceof ApiError ? err.kind : "UNKNOWN";
      dispatch({ type: "error", message: postcodeErrorMessage(kind) });
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (goDisabled) return;
    runSearch(value);
  }

  function handleSuggestionClick(s: string) {
    if (isLoading) return;
    setValue(s);
    runSearch(s);
  }

  function handleChange(next: string) {
    setValue(next);
    if (status.kind !== "idle" && status.kind !== "loading") {
      dispatch({ type: "reset" });
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Decorative background — soft warm gradient + blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/10 via-background to-surface-muted"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-brand/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent-blue/10 blur-3xl"
      />

      <div className="relative flex h-full w-full flex-col items-center justify-between px-6 pb-10 pt-14">
        {/* Brand */}
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-[2.6rem] font-extrabold leading-none tracking-tight text-ink">
            Chef<span className="text-brand">Pick</span>
          </h1>
          <p className="max-w-[18rem] text-sm leading-snug text-ink-muted">
            Restaurant discovery, made simple.
          </p>
        </header>

        {/* Pippo — sits in a tinted disc so the figure has presence */}
        <div className="relative flex flex-col items-center gap-4">
          <div
            className="absolute inset-0 -z-10 m-auto h-44 w-44 rounded-full bg-gradient-to-br from-brand/25 to-brand/5 blur-2xl"
            aria-hidden
          />
          <div className="rounded-full bg-surface/80 p-2 ring-1 ring-border/60 shadow-xl backdrop-blur">
            <Pippo state={pippoState} size="lg" />
          </div>
          {isNoResults ? (
            <p className="max-w-[20rem] text-center text-sm font-medium text-ink animate-fade-in">
              No restaurants near{" "}
              <span className="font-semibold text-brand-ink">{status.postcode}</span>. Try
              another postcode.
            </p>
          ) : (
            <p className="max-w-[20rem] text-center text-sm text-ink-muted">
              Tell me where you are and I’ll line up ten places worth a look.
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          <label htmlFor="postcode" className="sr-only">
            Postcode
          </label>
          <div
            className={cn(
              "flex items-center gap-2 rounded-full border bg-surface px-2 py-2 shadow-lg shadow-brand/5 transition-all",
              isError
                ? "border-destructive/60"
                : "border-border focus-within:border-brand focus-within:shadow-brand/15",
              isLoading && "opacity-60",
            )}
          >
            <input
              id="postcode"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              autoFocus={!welcomeOpen}
              autoComplete="postal-code"
              inputMode="text"
              spellCheck={false}
              disabled={isLoading}
              placeholder="Enter your postcode"
              className="h-10 flex-1 bg-transparent pl-3 text-base font-semibold uppercase tracking-wide text-ink placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted focus:outline-none"
              aria-invalid={isError}
              aria-describedby="postcode-hint postcode-error"
            />
            <Button
              type="submit"
              disabled={goDisabled}
              className="h-10 rounded-full px-5 font-semibold"
            >
              {isLoading ? "…" : (
                <>
                  Go
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Suggestion chips */}
          <div
            id="postcode-hint"
            className={cn(
              "flex flex-wrap items-center justify-center gap-1.5 transition-opacity",
              (isError || isNoResults) && "opacity-0",
            )}
          >
            <span className="text-xs text-ink-muted">Try one:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isLoading}
                onClick={() => handleSuggestionClick(s)}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-ink disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Inline error slot */}
          <p
            id="postcode-error"
            role="alert"
            className={cn(
              "min-h-[1.25rem] text-center text-xs font-medium text-destructive transition-opacity",
              isError ? "opacity-100" : "opacity-0",
            )}
          >
            {isError ? status.message : ""}
          </p>
        </form>

        {/* Tiny "what is this" link at the bottom */}
        <button
          type="button"
          onClick={() => setWelcomeOpen(true)}
          className="text-xs font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          New here? See the quick tour
        </button>
      </div>

      <WelcomeOverlay open={welcomeOpen} onClose={closeWelcome} />
    </div>
  );
}
