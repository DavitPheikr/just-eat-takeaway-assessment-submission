import { cn } from "@/lib/utils";
import greetingSrc from "@/assets/pippo/greeting-pippo.png";
import loadingSrc from "@/assets/pippo/loading-pippo.png";
import celebratingSrc from "@/assets/pippo/celebrating-pippo.png";
import sadSrc from "@/assets/pippo/sad-pippo.png";

export type PippoState = "greeting" | "loading" | "celebrating" | "sad";

const PIPPO_ASSETS: Record<PippoState, string> = {
  greeting: greetingSrc,
  loading: loadingSrc,
  celebrating: celebratingSrc,
  sad: sadSrc,
};

const PIPPO_ALT: Record<PippoState, string> = {
  greeting: "Pippo waving hello",
  loading: "Pippo thinking",
  celebrating: "Pippo celebrating",
  sad: "Pippo looking sad",
};

const SIZE_MAP = {
  xs: "h-12 w-12",
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-36 w-36",
  xl: "h-48 w-48",
} as const;

export type PippoSize = keyof typeof SIZE_MAP;

interface PippoProps {
  state: PippoState;
  size?: PippoSize;
  className?: string;
}

export function Pippo({ state, size = "md", className }: PippoProps) {
  const motionClass =
    state === "loading"
      ? "animate-pippo-sway"
      : state === "celebrating"
      ? "animate-pippo-pop"
      : "";

  return (
    <div className={cn("inline-flex items-center justify-center", SIZE_MAP[size], className)}>
      <img
        key={state}
        src={PIPPO_ASSETS[state]}
        alt={PIPPO_ALT[state]}
        className={cn("h-full w-full object-contain select-none", motionClass)}
        draggable={false}
      />
    </div>
  );
}
