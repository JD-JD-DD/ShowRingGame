"use client";

import { useEffect, useState } from "react";

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

export default function GlobalUtcClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-3 z-50 rounded-full border border-purple-300/20 bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-purple-100/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
      {now ? formatUtc(now) : "UTC"}
    </div>
  );
}
