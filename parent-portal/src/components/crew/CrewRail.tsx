import type { AgentId } from "@/lib/api";
import { CREW, CREW_TEXT, type CrewMember } from "./crew";
import { CrewAvatar } from "./CrewAvatar";

// Desktop only: the crew as a vertical line beside the chat. The working agent lights up.
export function CrewRail({ active }: { active: AgentId | null }): React.JSX.Element {
  return (
    <aside
      aria-label={CREW_TEXT.stripLabel}
      className="hidden w-[200px] flex-col justify-center lg:flex"
    >
      <p className="mb-4 text-xs font-bold tracking-wide text-[#8a8073] uppercase">
        {CREW_TEXT.stripLabel}
      </p>
      <ol className="flex flex-col">
        {CREW.map((member: CrewMember, index: number) => (
          <li key={member.id} className="flex flex-col">
            {index > 0 ? <span className="ml-[21px] h-5 w-0.5 bg-[#E8A33D]/50" /> : null}
            <div className="flex items-center gap-3">
              <CrewAvatar member={member} size="md" glowing={active === member.id} />
              <span
                className={
                  active === member.id
                    ? "text-sm font-bold text-[#1F1B16]"
                    : "text-sm text-[#6b6257]"
                }
              >
                {member.name}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
