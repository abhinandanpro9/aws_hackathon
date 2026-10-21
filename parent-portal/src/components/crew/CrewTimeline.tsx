import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, BellIcon } from "lucide-react";
import type { AgentId, AgentStep, AskResponse } from "@/lib/api";
import { CREW_TEXT, STEP_DELAY_MS, crewMember } from "./crew";
import { CrewAvatar } from "./CrewAvatar";
import { playVoice } from "./voice";

// Shows each crew step under an answer, one at a time, so the handoffs can be followed.
// FLOW: answer arrives -> step 1 appears -> 300ms -> step 2 ... -> done, nothing glows
// 1. onActive tells the crew strip who is working, so the right avatar glows
// 2. voices play per step only when the parent turned them on

interface CrewTimelineProps {
  reply: AskResponse;
  voiceOn: boolean;
  onActive: (agent: AgentId | null) => void;
}

export function CrewTimeline({
  reply,
  voiceOn,
  onActive,
}: CrewTimelineProps): React.JSX.Element | null {
  const steps: AgentStep[] = reply.agents ?? [];
  const [shown, setShown] = useState<number>(0);
  const voiceRef = useRef<boolean>(voiceOn);
  voiceRef.current = voiceOn;
  const activeRef = useRef(onActive);
  activeRef.current = onActive;

  useEffect(() => {
    if (steps.length === 0) return;
    let index = 0;
    const reveal = (): void => {
      const step: AgentStep | undefined = steps[index];
      if (step === undefined) {
        activeRef.current(null);
        return;
      }
      index += 1;
      setShown(index);
      activeRef.current(step.agent);
      if (voiceRef.current) playVoice(step.agent);
      timer = window.setTimeout(reveal, STEP_DELAY_MS);
    };
    let timer: number = window.setTimeout(reveal, 0);
    return () => window.clearTimeout(timer);
    // Runs once per answer. The steps never change after the answer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (steps.length === 0 && !reply.notified) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-2.5">
      {steps.length > 0 ? (
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {CREW_TEXT.timelineHeading}
        </p>
      ) : null}
      <ol className="flex flex-col gap-1.5">
        {steps.slice(0, shown).map((step: AgentStep, index: number) => {
          const member = crewMember(step.agent);
          const next = crewMember(step.handoffTo);
          return (
            <li
              key={`${step.agent}-${index}`}
              className="flex animate-in items-start gap-2 text-xs leading-snug duration-300 fade-in slide-in-from-left-2"
            >
              {member ? <CrewAvatar member={member} size="sm" /> : null}
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="font-semibold" style={{ color: member?.color }}>
                  {member?.name ?? step.agent}
                </span>
                <span className="text-foreground"> · {step.action}</span>
                {next ? (
                  <span className="ml-1 inline-flex items-center gap-1 align-middle whitespace-nowrap text-muted-foreground">
                    <ArrowRightIcon className="size-3" aria-label="handed to" />
                    <span className="font-semibold" style={{ color: next.color }}>
                      {next.name}
                    </span>
                  </span>
                ) : null}
                {step.a2a ? (
                  <span
                    title={CREW_TEXT.a2aTip(step.a2a.taskId)}
                    className="ml-1.5 inline-flex items-center rounded-full bg-[#FFF3DC] px-1.5 py-px align-middle text-[10px] font-bold whitespace-nowrap text-[#8a5a12]"
                  >
                    {CREW_TEXT.a2aPill(step.a2a.method)}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {reply.notified && shown >= steps.length ? (
        <p className="flex animate-in items-center gap-1.5 text-xs font-medium text-foreground duration-300 fade-in">
          <BellIcon className="size-3.5 shrink-0 text-[#10b981]" aria-hidden="true" />
          {CREW_TEXT.notified(reply.notified.to)}
        </p>
      ) : null}
    </div>
  );
}
