"use client";

import { useEffect, useState } from "react";
import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "@showring/rules";

import { getCurrentEpoch } from "@/lib/gameClock";

const SHOW_DAY_NAMES = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

function formatUtc(date: Date): string {
  return date
    .toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
      timeZoneName: "short",
    })
    .replace(",", "");
}

function getShowCalendarLabel(): string {
  const currentEpoch = getCurrentEpoch();
  const hourInYear = currentEpoch % SHOW_YEAR_HOURS;
  const year = Math.floor(currentEpoch / SHOW_YEAR_HOURS) + 1;

  if (hourInYear === SHOW_YEAR_HOURS - 1) {
    return `Year ${year} - Annual Day`;
  }

  const showCalendarHourInYear = Math.min(hourInYear, SHOW_YEAR_HOURS - 2);
  const weekInYear =
    Math.floor(showCalendarHourInYear / SHOW_WEEK_HOURS) + 1;
  const dayInWeek = showCalendarHourInYear % SHOW_WEEK_HOURS;

  return `Year ${year} - Week ${weekInYear} - ${SHOW_DAY_NAMES[dayInWeek]}`;
}

export default function GlobalUtcClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="game-header__status pointer-events-none fixed right-4 top-3 z-50 rounded-2xl px-3 py-1.5 text-right text-[11px] font-semibold leading-4 backdrop-blur">
      <div>{now ? formatUtc(now) : "UTC"}</div>
      <div className="game-header__status-muted">
        {now ? getShowCalendarLabel() : "Show Week"}
      </div>
    </div>
  );
}
