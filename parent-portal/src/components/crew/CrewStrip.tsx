import { Volume2Icon, VolumeXIcon } from "lucide-react";
import type { AgentId } from "@/lib/api";
import { CREW, CREW_TEXT, type CrewMember } from "./crew";
import { CrewAvatar } from "./CrewAvatar";

interface CrewStripProps {
  /** The crew member working right now. That avatar glows. */
  active: AgentId | null;
  voiceOn: boolean;
  onToggleVoice: () => void;
}

export function CrewStrip({ active, voiceOn, onToggleVoice }: CrewStripProps): React.JSX.Element {
  return (
    <div className="border-b border-border bg-card/60">
      <div className="mx-auto flex w-full max-w-[480px] items-center gap-2 px-4 py-2">
        <ul aria-label={CREW_TEXT.stripLabel} className="flex flex-1 justify-between gap-1">
          {CREW.map((member: CrewMember) => (
            <li key={member.id} className="flex flex-col items-center gap-1">
              <CrewAvatar member={member} size="md" glowing={active === member.id} />
              <span
                className={
                  active === member.id
                    ? "text-[11px] leading-none font-bold text-foreground"
                    : "text-[11px] leading-none text-muted-foreground"
                }
              >
                {member.name}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onToggleVoice}
          aria-pressed={voiceOn}
          aria-label={voiceOn ? CREW_TEXT.voiceOn : CREW_TEXT.voiceOff}
          title={voiceOn ? CREW_TEXT.voiceOn : CREW_TEXT.voiceOff}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {voiceOn ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
        </button>
      </div>
    </div>
  );
}
