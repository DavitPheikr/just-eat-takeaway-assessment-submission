import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ReviewSheetProps {
  open: boolean;
  restaurantName: string;
  initialValue: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (value: string | null) => void;
}

const MAX_LEN = 4000;

/**
 * Bottom sheet for editing reviewText. Rendered as an absolutely-positioned
 * panel inside its parent (the AppShell viewport / PhoneFrame) — NOT a Radix
 * Portal — so it stays clipped to the phone frame on desktop instead of
 * covering the entire window.
 *
 * Mounting strategy: the sheet shell stays mounted so the slide transition
 * works on both open and close. While closed, it is `invisible`,
 * pointer-events-none, and translated off-screen — and crucially the
 * textarea is unmounted so its `autoFocus` cannot pull the hidden sheet
 * back into view via the browser's scroll-to-focused-element behavior.
 */
export function ReviewSheet({
  open,
  restaurantName,
  initialValue,
  isSaving = false,
  onClose,
  onSave,
}: ReviewSheetProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset whenever the sheet opens with a new target.
  useEffect(() => {
    if (open) setValue(initialValue ?? "");
  }, [open, initialValue]);

  // Focus the textarea after the open transition starts. We do this manually
  // (instead of `autoFocus`) so focus only happens when the sheet is actually
  // visible — preventing the browser from scrolling a hidden sheet into view.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    onSave(trimmed.length === 0 ? null : trimmed);
  };

  return (
    <>
      {/* Scrim */}
      <button
        type="button"
        aria-hidden={!open}
        tabIndex={-1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-40 bg-black/40 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Sheet shell */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit note"
        aria-hidden={!open}
        className={cn(
          "absolute inset-x-0 bottom-0 z-50 flex max-h-[80%] flex-col rounded-t-[28px] border-t border-border bg-surface shadow-2xl transition-transform duration-300 ease-out-soft",
          open
            ? "translate-y-0 pointer-events-auto visible"
            : "translate-y-full pointer-events-none invisible",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Inner content only mounts when open. This guarantees the textarea
            (and its autofocus behavior) cannot run while the sheet is hidden. */}
        {open && (
          <>
            {/* Grabber */}
            <div className="flex justify-center pt-2">
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </div>

            {/* Header */}
            <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold text-ink">Your note</h2>
                <p className="truncate text-sm text-ink-muted">About {restaurantName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-2 pt-2">
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
                onKeyDown={(e) => {
                  // Enter saves; Shift+Enter inserts a newline.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isSaving) handleSubmit();
                  }
                }}
                placeholder="What did you think? Anything to remember for next time? (Enter to save, Shift+Enter for newline)"
                className="min-h-[140px] resize-none"
              />
              <p className="mt-2 text-right text-xs text-ink-muted">
                {value.length}/{MAX_LEN}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
