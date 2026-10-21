import { useState } from "react";
import { CheckIcon, GithubIcon } from "lucide-react";
import { CREW, type CrewMember } from "@/components/crew/crew";
import { SunIcon } from "@/lib/icons";
import { HearAvaCard } from "@/components/crew/HearAvaCard";
import { HeroDemo } from "./HeroDemo";
import { HowItWorks } from "./HowItWorks";
import { LANDING } from "./constants";

// The front page, in the live split-screen layout.
// FLOW: hero (pitch | live phone + crew rail) -> crew -> how it works -> why trust it -> built with

export function Landing(): React.JSX.Element {
  return (
    <div className="min-h-svh bg-[#FFFBF3] text-[#1F1B16]">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-full bg-[#E8A33D] text-white">
          <SunIcon className="size-5" aria-hidden="true" />
        </span>
        <span className="text-base font-bold">{LANDING.brand}</span>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-5 pt-6 pb-20">
        <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-6">
            <h1 className="max-w-xl text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-6xl">
              {LANDING.headline}
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-[#5c5348] sm:text-xl">{LANDING.subline}</p>
            <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/demo?autostart=1"
                className="flex min-h-12 items-center justify-center rounded-full bg-[#E8A33D] px-7 text-base font-bold text-white shadow-md hover:brightness-95"
              >
                {LANDING.tryLive}
              </a>
              <a
                href={LANDING.dashboardUrl}
                className="flex min-h-12 items-center justify-center rounded-full border-2 border-[#1F1B16] px-7 text-base font-bold hover:bg-white"
              >
                {LANDING.dashboard}
              </a>
            </div>
            <span className="text-sm text-[#6b6257] sm:pl-1">{LANDING.dashboardCaption}</span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {LANDING.proof.map((chip: string) => (
                <li
                  key={chip}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm"
                >
                  <CheckIcon className="size-3.5 text-[#E8A33D]" aria-hidden="true" />
                  {chip}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 justify-center rounded-[36px] bg-[#FFF3DC] px-4 py-8 sm:px-8">
            <HeroDemo />
          </div>
        </section>

        <section className="flex flex-col gap-8 rounded-[36px] bg-white px-6 py-12 shadow-sm sm:px-12">
          <div className="flex max-w-3xl flex-col gap-4">
            <p className="text-sm font-bold tracking-wide text-[#E8A33D] uppercase">
              {LANDING.missionEyebrow}
            </p>
            <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">
              {LANDING.missionHeadline}
            </h2>
            <p className="text-lg leading-relaxed text-[#5c5348]">{LANDING.missionBody}</p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {LANDING.outcomes.map((outcome) => (
              <li key={outcome.big} className="flex flex-col gap-2 rounded-3xl bg-[#FFFBF3] p-6">
                <span className="text-4xl font-extrabold text-[#E8A33D]">{outcome.big}</span>
                <span className="text-base leading-snug text-[#1F1B16]">{outcome.line}</span>
              </li>
            ))}
          </ul>
          <p className="text-base font-semibold text-[#5c5348]">{LANDING.missionClose}</p>
        </section>

        <section className="flex flex-col gap-8">
          <SectionTitle>{LANDING.crewHeading}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {CREW.map((member: CrewMember) => (
                <article key={member.id} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_10px_30px_-18px_rgba(31,27,22,0.4)]">
                  <div className="h-2" style={{ backgroundColor: member.color }} />
                  <Portrait member={member} />
                  <div className="flex flex-col gap-1 p-4 sm:p-5">
                    <p className="text-lg font-bold">{member.name}</p>
                    <p className="text-[15px] font-semibold" style={{ color: member.color }}>
                      {LANDING.roles[member.id]}
                    </p>
                    <p className="text-[15px] leading-relaxed text-[#5c5348]">
                      {LANDING.owns[member.id]}
                    </p>
                  </div>
                </article>
            ))}
            <article className="flex flex-col overflow-hidden rounded-3xl border-2 border-dashed border-[#1F1B16]/30">
              <div className="flex aspect-square items-center justify-center bg-[#1F1B16]/5">
                <img
                  src="/avatars/director.png"
                  alt=""
                  className="size-4/5 rounded-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1 p-4 sm:p-5">
                <p className="text-lg font-bold">{LANDING.director}</p>
                <p className="text-[15px] leading-relaxed text-[#5c5348]">{LANDING.directorOwns}</p>
              </div>
            </article>
            <article className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_10px_30px_-18px_rgba(31,27,22,0.4)]">
              <HearAvaCard fill />
              <div className="flex flex-col gap-1 p-4 sm:p-5">
                <p className="text-lg font-bold">{LANDING.avaPitch}</p>
                <p className="text-[15px] leading-relaxed text-[#5c5348]">{LANDING.avaPitchBody}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <SectionTitle>{LANDING.howHeading}</SectionTitle>
          <HowItWorks />
        </section>

        <section className="flex flex-col gap-8">
          <SectionTitle>{LANDING.trustHeading}</SectionTitle>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LANDING.guardrails.map((line: string) => (
              <li
                key={line}
                className="flex flex-col gap-3 rounded-3xl bg-white p-6 text-lg leading-snug font-semibold shadow-sm"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-[#FFF3DC]">
                  <CheckIcon className="size-5 text-[#E8A33D]" aria-hidden="true" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-6">
          <SectionTitle>{LANDING.builtHeading}</SectionTitle>
          <div className="flex flex-wrap gap-3">
            {LANDING.builtWith.map((name: string) => (
              <span
                key={name}
                className="rounded-full border border-[#1F1B16]/15 bg-white px-5 py-2 text-base font-semibold"
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1F1B16]/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-8 text-sm text-[#5c5348]">
          <span>{LANDING.brand}</span>
          <a
            href={LANDING.githubUrl}
            className="flex items-center gap-1.5 font-semibold hover:text-[#1F1B16]"
          >
            <GithubIcon className="size-4" aria-hidden="true" />
            {LANDING.github}
          </a>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="text-3xl font-extrabold tracking-tight">{children}</h2>;
}

// The portrait, or a big initial in the agent's colour while the image is missing.
function Portrait({ member }: { member: CrewMember }): React.JSX.Element {
  const [broken, setBroken] = useState<boolean>(false);
  return (
    <div
      className="flex aspect-square items-center justify-center"
      style={{ backgroundColor: `${member.color}1a` }}
    >
      {broken ? (
        <span className="text-6xl font-extrabold" style={{ color: member.color }}>
          {member.name.charAt(0)}
        </span>
      ) : (
        <img
          src={`/avatars/${member.id}.png`}
          alt={member.name}
          className="size-4/5 rounded-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}
