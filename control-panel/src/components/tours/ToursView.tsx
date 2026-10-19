"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

// The tour calendar: when tours run, and which slots parents have already taken.
// FLOW: engine /api/bookings -> schedule + held slots -> upcoming tour days, slot by slot
// 1. live rows only; an empty calendar shows an empty calendar
// 2. the desk itself books these (the one enabled action), so this page is where an
//    operator sees what the AI did on their behalf

interface BookingsData {
  schedule: { days: string[]; times: string[]; durationMinutes: number };
  bookings: { date: string; time: string }[];
}

const DAYS_AHEAD = 28;

function upcomingTourDates(days: string[]): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
    if (days.includes(weekday)) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function prettyDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function ToursView() {
  const [data, setData] = useState<BookingsData | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    void api.bookings().then((result) => {
      setData(result);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading the calendar…</p>;
  if (data === null)
    return <p className="text-sm text-muted-foreground">Could not reach the front desk.</p>;

  const taken = new Set(data.bookings.map((b) => `${b.date}|${b.time}`));
  const dates = upcomingTourDates(data.schedule.days);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">The schedule</CardTitle>
          <CardDescription>
            Tours run {data.schedule.days.join(" and ")} at {data.schedule.times.join(" and ")},{" "}
            {data.schedule.durationMinutes} minutes each. Theo books open slots itself — held slots
            appear here the moment a parent takes one.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Next {dates.length} tour days</CardTitle>
          <CardDescription>One row per tour day. Amber means a parent holds it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {dates.map((date, index) => (
            <div
              key={date}
              className={
                index === 0
                  ? "flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  : "flex flex-col gap-2 border-t border-border py-3 sm:flex-row sm:items-center sm:justify-between"
              }
            >
              <span className="text-sm font-medium text-foreground">{prettyDate(date)}</span>
              <div className="flex flex-wrap gap-1.5">
                {data.schedule.times.map((time) =>
                  taken.has(`${date}|${time}`) ? (
                    <Badge key={time} className="border-warning/40 bg-warning-soft text-warning">
                      {time} · booked
                    </Badge>
                  ) : (
                    <Badge key={time} variant="outline">
                      {time} · open
                    </Badge>
                  ),
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
