import { ArrowDownIcon, ArrowRightIcon, CheckIcon, UserIcon } from "lucide-react";
import { crewMember, type CrewMember } from "@/components/crew/crew";
import { LANDING } from "./constants";

// "How it works" as a path of real portraits.
// FLOW: Maya asks -> Ava picks -> fork: (Lena/Nora/Theo -> cited answer) | (Max -> named person)
// 1. desktop runs left to right; mobile stacks top to bottom with the line running down

const INK = "#1F1B16";
const SUN = "#E8A33D";
const HOW = LANDING.how;

function member(id: string): CrewMember {
  const found: CrewMember | undefined = crewMember(id);
  if (!found) throw new Error(`unknown crew member ${id}`);
  return found;
}

export function HowItWorks(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8 rounded-3xl bg-white px-6 py-10 shadow-sm lg:px-8">
    <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-center lg:justify-center lg:gap-0">
      <Step caption={HOW.parent} name="Parent">
        <Ring color={INK}>
          <span className="flex size-full items-center justify-center bg-[#FFF3DC]">
            <UserIcon className="size-8 text-[#1F1B16]" aria-hidden="true" />
          </span>
        </Ring>
      </Step>
      <Line />
      <Step caption={HOW.ava} name="Ava">
        <Portrait member={member("ava")} />
      </Step>
      <Line label={HOW.a2a} />
      <div className="flex flex-col gap-8 lg:gap-6 lg:border-l-2 lg:border-dotted lg:border-[#E8A33D]/60 lg:pl-6">
        <Branch label={HOW.everyday}>
          <Step caption={HOW.specialists} name="Lena · Nora · Theo">
            <div className="flex -space-x-5">
              {["lena", "nora", "theo"].map((id: string) => (
                <Portrait key={id} member={member(id)} />
              ))}
            </div>
          </Step>
          <Line top />
          <Chip>
            <span className="flex size-7 items-center justify-center rounded-full bg-[#E8A33D]">
              <CheckIcon className="size-4 text-white" aria-hidden="true" />
            </span>
            {HOW.cited}
          </Chip>
        </Branch>
        <Branch label={HOW.sensitive}>
          <Step caption={HOW.max} name="Max">
            <Portrait member={member("max")} />
          </Step>
          <Line top />
          <Chip>
            <img src="/avatars/director.png" alt="" className="size-7 rounded-full object-cover" />
            {HOW.person}
          </Chip>
        </Branch>
      </div>
    </div>
    <p className="text-center text-[15px] text-[#5c5348]">
      {HOW.a2aNote}{" "}
      <a href={HOW.a2aUrl} className="font-semibold whitespace-nowrap text-[#1F1B16] underline underline-offset-4">
        {HOW.a2aLink}
      </a>
    </p>
    </div>
  );
}

function Branch({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 lg:items-start">
      <p className="text-xs font-bold tracking-wide text-[#6b6257] uppercase">{label}</p>
      <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-start lg:gap-0">
        {children}
      </div>
    </div>
  );
}

function Step({
  caption,
  name,
  children,
}: {
  caption: string;
  name: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2 text-center">
      {children}
      <p className="text-base font-bold">{name}</p>
      <p className="text-[15px] leading-snug text-[#5c5348] lg:whitespace-nowrap">{caption}</p>
    </div>
  );
}

function Ring({ color, children }: { color: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      className="block size-[72px] shrink-0 overflow-hidden rounded-full border-[3px] bg-white shadow-[0_0_0_3px_white]"
      style={{ borderColor: color }}
    >
      {children}
    </span>
  );
}

function Portrait({ member: who }: { member: CrewMember }): React.JSX.Element {
  return (
    <Ring color={who.color}>
      <img src={`/avatars/${who.id}.png`} alt={who.name} className="size-full object-cover" />
    </Ring>
  );
}

function Chip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="flex items-center gap-2 rounded-full border lg:mt-[18px] border-[#1F1B16]/10 bg-[#FFFBF3] py-1.5 pr-4 pl-1.5 text-[15px] font-semibold whitespace-nowrap shadow-sm">
      {children}
    </span>
  );
}

// Dotted connector with a small arrow: across on desktop, down on mobile.
// top: inside a branch row, line up with the portrait's middle instead of the row's middle.
// label: a small tag on the line, e.g. "A2A" on the hand-offs out of Ava.
function Line({ top = false, label }: { top?: boolean; label?: string }): React.JSX.Element {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center text-[#E8A33D] ${top ? "lg:self-start lg:pt-[28px]" : ""}`}
    >
      {label ? (
        <span className="absolute left-full ml-1 rounded-full bg-[#FFF3DC] px-2 py-0.5 text-xs font-bold text-[#8a5a12] lg:static lg:left-auto lg:mr-1 lg:ml-0">
          {label}
        </span>
      ) : null}
      <span className="flex flex-col items-center lg:flex-row">
        <span
          className="h-6 border-l-2 border-dotted lg:h-0 lg:w-8 lg:border-t-2 lg:border-l-0"
          style={{ borderColor: SUN }}
        />
        <ArrowDownIcon className="-mt-1 size-4 lg:hidden" aria-hidden="true" />
        <ArrowRightIcon className="-ml-1 hidden size-4 lg:block" aria-hidden="true" />
      </span>
    </span>
  );
}
