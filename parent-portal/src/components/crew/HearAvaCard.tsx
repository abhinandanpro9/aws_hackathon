import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "lucide-react";
import { CREW_TEXT } from "./crew";
import { playVoice } from "./voice";

// Ava's live face from Masky, loaded only after a tap, because browsers need one for sound.
// FLOW: portrait + "Hear Ava" -> tap -> iframe src set -> loads within 4s ? live : ava.mp3
// 1. data-hear-ava lets the chat's first-tap greeting skip this tap, so audio never doubles

const LOAD_TIMEOUT_MS = 4000;

type Stage = "idle" | "loading" | "live" | "fallback";

// fill: stretch to the parent's width (landing crew grid) instead of the fixed chat size.
export function HearAvaCard({
  className = "",
  fill = false,
}: {
  className?: string;
  fill?: boolean;
}): React.JSX.Element {
  const [stage, setStage] = useState<Stage>("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const start = (): void => {
    setStage("loading");
    timer.current = window.setTimeout(() => {
      setStage("fallback");
      playVoice("ava");
    }, LOAD_TIMEOUT_MS);
  };

  const loaded = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setStage((current: Stage) => (current === "loading" ? "live" : current));
  };

  const showFrame: boolean = stage === "loading" || stage === "live";

  return (
    <figure data-hear-ava className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className={`relative aspect-square overflow-hidden bg-[#F6EEDF] ${
          fill ? "w-full" : "w-[120px] rounded-[20px] shadow-sm sm:w-[320px]"
        }`}
      >
        {showFrame ? (
          <iframe
            src={CREW_TEXT.maskyUrl}
            width={320}
            height={320}
            allow="autoplay; fullscreen"
            title={CREW_TEXT.maskyTitle}
            onLoad={loaded}
            className="size-full border-0"
          />
        ) : (
          <>
            <img src="/avatars/ava.png" alt="Ava" className="size-full object-cover" />
            {stage === "idle" ? (
              <button
                type="button"
                onClick={start}
                className="absolute inset-x-2 bottom-2 flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1F1B16]/85 px-3 text-xs font-bold text-white hover:bg-[#1F1B16] sm:inset-x-6 sm:bottom-5 sm:min-h-11 sm:text-sm"
              >
                <PlayIcon className="size-3.5 fill-current" aria-hidden="true" />
                {CREW_TEXT.hearAva}
              </button>
            ) : null}
          </>
        )}
      </div>
      {fill ? null : (
        <figcaption className="text-xs font-medium text-[#6b6257]">
          {CREW_TEXT.maskyCaption}
        </figcaption>
      )}
    </figure>
  );
}
