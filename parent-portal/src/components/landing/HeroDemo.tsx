import { useEffect, useState } from "react";
import { askFrontDesk, type AgentStep, type AskResponse } from "@/lib/api";
import { ReplyText } from "@/components/answer/ReplyText";
import { CrewAvatar } from "@/components/crew/CrewAvatar";
import { crewMember } from "@/components/crew/crew";
import { DocumentIcon } from "@/lib/icons";
import { CANNED_LUNCH } from "./canned";
import { LANDING } from "./constants";

// The live mini-demo in the hero: a real question to the real API, played back step by step.
// FLOW: page loads -> parent bubble -> POST /api/ask -> rail lights each agent -> answer shows
// 1. the API failing (unreachable() has no conversationId) plays CANNED_LUNCH instead
// 2. sessionId starts "demo-landing-" so the operator can tell demo runs apart

const RAIL_STEP_MS = 650;

export function HeroDemo(): React.JSX.Element {
  const [reply, setReply] = useState<AskResponse | null>(null);
  const [shown, setShown] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    void askFrontDesk(LANDING.heroQuestion, `demo-landing-${Date.now()}`, null).then(
      (result: AskResponse) => {
        if (cancelled) return;
        const usable = result.conversationId !== "" && (result.agents?.length ?? 0) > 0;
        setReply(usable ? result : CANNED_LUNCH);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const steps: AgentStep[] = reply?.agents ?? [];
  const source: string | null = reply?.citation ?? null;
  const hasEnd: boolean = reply?.notified !== undefined || source !== null;
  const total: number = steps.length + (hasEnd ? 1 : 0);

  useEffect(() => {
    if (reply === null || shown >= total) return;
    const timer = window.setTimeout(() => setShown((n: number) => n + 1), RAIL_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [reply, shown, total]);

  const done: boolean = reply !== null && shown >= total;
  const notifiedName: string = reply?.notified?.to.split(" (")[0]?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
      <div className="w-full max-w-[290px] shrink-0 overflow-hidden rounded-[36px] border-[6px] border-[#1F1B16] bg-white shadow-[0_24px_60px_-20px_rgba(31,27,22,0.35)]">
        <div className="flex items-center gap-2 border-b border-[#F1E6D2] bg-[#FFFBF3] px-4 py-3">
          <span className="text-sm font-semibold text-[#1F1B16]">{LANDING.phoneHeader}</span>
          <span aria-hidden="true">🟢</span>
        </div>
        <div className="flex h-[400px] flex-col gap-3 overflow-hidden p-3">
          <p className="ml-auto max-w-[85%] animate-in rounded-2xl rounded-tr-sm bg-[#E8A33D] px-3 py-2 text-sm text-white duration-500 fade-in slide-in-from-bottom-2">
            {LANDING.heroQuestion}
          </p>
          {done && reply ? (
            <div className="max-w-[92%] animate-in rounded-2xl rounded-tl-sm border border-[#F1E6D2] bg-white p-3 text-sm shadow-sm duration-500 fade-in slide-in-from-bottom-2 [&_p]:text-sm">
              <p className="mb-1 text-[11px] font-bold text-[#7c3aed]">Ava</p>
              <ReplyText text={reply.message} />
              {source ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#FFF3DC] px-2 py-0.5 text-[11px] font-medium text-[#8a5a12]">
                  <DocumentIcon className="size-3" aria-hidden="true" />
                  {source}
                </span>
              ) : null}
            </div>
          ) : (
            <div
              className="flex w-fit gap-1 rounded-2xl rounded-tl-sm bg-[#F6EEDF] px-3 py-3"
              aria-label="Ava is replying"
            >
              {[0, 150, 300].map((delay: number) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-[#1F1B16]/40"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ol aria-label={LANDING.railLabel} className="flex w-full max-w-[290px] flex-col sm:w-[170px] sm:pt-10">
        <li className="mb-3 text-xs font-bold tracking-wide text-[#6b6257] uppercase">
          {LANDING.railLabel}
        </li>
        {steps.slice(0, shown).map((step: AgentStep, index: number) => {
          const member = crewMember(step.agent);
          return (
            <li
              key={`${step.agent}-${index}`}
              className="flex animate-in flex-col duration-500 fade-in slide-in-from-left-3"
            >
              {index > 0 ? <span className="ml-[21px] h-6 w-0.5 bg-[#E8A33D]" /> : null}
              <div className="flex items-center gap-2">
                {member ? (
                  <CrewAvatar member={member} size="md" glowing={index === shown - 1 && !done} />
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1F1B16]">{member?.name ?? step.agent}</p>
                  <p className="text-xs leading-snug text-[#5c5348]">{step.action}</p>
                </div>
              </div>
            </li>
          );
        })}
        {hasEnd && shown > steps.length ? (
          <li className="flex animate-in flex-col duration-500 fade-in slide-in-from-left-3">
            <span className="ml-[21px] h-6 w-0.5 bg-[#E8A33D]" />
            <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#1F1B16] shadow-sm">
              {reply?.notified
                ? `📨 ${reply.notified.channel === "n8n" ? "n8n" : "Call-back"} → ${notifiedName} ✓`
                : `✓ cited: ${shortCitation(source ?? "")}`}
            </p>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

/** "Family Handbook, Page 8, MEALS AND FOOD" -> "Family Handbook p.8". */
function shortCitation(citation: string): string {
  const match: RegExpMatchArray | null = citation.match(/^(.*?),\s*Page\s*(\d+)/i);
  return match ? `${match[1]} p.${match[2]}` : citation;
}
