"use client";

import { useEffect, useMemo, useState } from "react";

import { formatShortCountdownHours } from "@/lib/gameTimeFormat";

const UPDATE_INTERVAL_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type ShowCountdownTextProps = {
  targetEpoch: number | null;
  initialCurrentEpoch: number;
  fallbackLabel: string;
  prefix?: string;
  suffix?: string;
};

export function ShowCountdownText({
  targetEpoch,
  initialCurrentEpoch,
  fallbackLabel,
  prefix = "",
  suffix = "",
}: ShowCountdownTextProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (targetEpoch === null) {
      return;
    }

    const mountedAtMs = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - mountedAtMs);
    }, UPDATE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [targetEpoch]);

  const label = useMemo(() => {
    if (targetEpoch === null) {
      return fallbackLabel;
    }

    const displayedCurrentEpoch = initialCurrentEpoch + elapsedMs / HOUR_MS;
    const remainingHours = targetEpoch - displayedCurrentEpoch;

    if (remainingHours <= 0) {
      return fallbackLabel;
    }

    return `${prefix}${formatShortCountdownHours(remainingHours)}${suffix}`;
  }, [elapsedMs, fallbackLabel, initialCurrentEpoch, prefix, suffix, targetEpoch]);

  return <>{label}</>;
}
