"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type ApiActivity, type ApiAgent, type SponsorMode } from "@/lib/api";
import { CREW_TEXTS, FALLBACK_AGENTS, SPONSORS } from "./constants";

const POLL_MS = 2000;

function avatarSrc(id: string): string {
  return `/avatars/${id}.png`;
}

function Avatar({ id, name, color, size = 40 }: { id: string; name: string; color: string; size?: number }) {
  const [failed, setFailed] = useState<boolean>(false);
  if (failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
        style={{ width: size, height: size, backgroundColor: color }}
        aria-hidden
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={avatarSrc(id)}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function timeLabel(at: string | undefined): string {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function CrewView() {
  const [agents, setAgents] = useState<ApiAgent[]>(FALLBACK_AGENTS);
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [sponsors, setSponsors] = useState<Record<string, { mode: SponsorMode }> | null>(null);

  useEffect(() => {
    void api.agents().then((list) => {
      if (list !== null && list.length > 0) setAgents(list);
    });
    void api.sponsors().then(setSponsors);
  }, []);

  // ?autostart=1 asks one demo question so the feed fills live. The ref stops a second ask
  // when React mounts the effect twice in development.
  const autostarted = useRef<boolean>(false);
  useEffect(() => {
    if (autostarted.current) return;
    if (new URLSearchParams(window.location.search).get("autostart") !== "1") return;
    autostarted.current = true;
    void api.ask(CREW_TEXTS.autostartQuestion, `demo-crew-${Date.now()}`);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      void api.activity(50).then((events) => {
        if (alive) setActivity(events);
      });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const nameOf = (id: string): string => byId.get(id)?.name ?? id;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">{CREW_TEXTS.chartTitle}</CardTitle>
            <CardDescription>{CREW_TEXTS.chartDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border-2 border-primary/40 bg-background px-4 py-3">
              <Avatar id="director" name="Director" color="#1f2937" size={48} />
              <div>
                <p className="text-sm font-semibold">{CREW_TEXTS.directorName}</p>
                <p className="text-xs text-muted-foreground">{CREW_TEXTS.directorRole}</p>
              </div>
            </div>
            <div className="h-6 w-px bg-border" aria-hidden />
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-start gap-3 rounded-xl border bg-background p-3"
                  style={{ borderTopColor: agent.color, borderTopWidth: 4 }}
                >
                  <Avatar id={agent.id} name={agent.name} color={agent.color} size={44} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                    {agent.tool ? (
                      <p className="mt-1 truncate font-mono text-xs text-foreground/80">{agent.tool}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">{CREW_TEXTS.feedTitle}</CardTitle>
            <CardDescription>{CREW_TEXTS.feedDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{CREW_TEXTS.feedEmpty}</p>
            ) : (
              activity.map((event, index) => {
                const agent = byId.get(event.agent);
                return (
                  <div
                    key={`${event.at ?? ""}-${event.agent}-${index}`}
                    className="flex items-start gap-3 rounded-lg border bg-background p-3"
                  >
                    <Avatar
                      id={event.agent}
                      name={agent?.name ?? event.agent}
                      color={agent?.color ?? "#64748b"}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">
                          {event.handoffTo
                            ? `${nameOf(event.agent)} → ${nameOf(event.handoffTo)}`
                            : nameOf(event.agent)}
                        </span>{" "}
                        <span className="text-foreground/90">{event.action}</span>
                      </p>
                      {event.question ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">“{event.question}”</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeLabel(event.at)}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="font-display text-xl">{CREW_TEXTS.sponsorsTitle}</CardTitle>
          <CardDescription>{CREW_TEXTS.sponsorsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {SPONSORS.map((sponsor) => {
            const mode = sponsors?.[sponsor.key]?.mode ?? null;
            return (
              <div key={sponsor.key} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{sponsor.name}</p>
                  <p className="text-xs text-muted-foreground">{sponsor.job}</p>
                </div>
                <ModeBadge mode={mode} />
              </div>
            );
          })}
          {sponsors === null ? (
            <p className="text-xs text-muted-foreground">{CREW_TEXTS.sponsorsUnknown}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ModeBadge({ mode }: { mode: SponsorMode | null }) {
  if (mode === "REAL") return <Badge className="bg-emerald-600 text-white">REAL</Badge>;
  if (mode === "CACHED") return <Badge className="bg-amber-500 text-white">CACHED</Badge>;
  if (mode === "FALLBACK") return <Badge variant="secondary">FALLBACK</Badge>;
  return <Badge variant="outline">{CREW_TEXTS.notReported}</Badge>;
}
