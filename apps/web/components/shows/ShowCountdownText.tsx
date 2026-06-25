"use client";

import { useEffect, useMemo, useState } from "react";

import { epochToDate } from "@/lib/gameClock";
import { formatRealCountdownMs } from "@/lib/gameTimeFormat";

const UPDATE_INTERVAL_MS = 60 * 1000;

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
  const [msRemaining, setMsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (targetEpoch === null) {
      return;
    }

    const targetMs = epochToDate(targetEpoch).getTime();
    const updateRemaining = () => {
      setMsRemaining(targetMs - Date.now());
    };

    updateRemaining();
    const intervalId = window.setInterval(() => {
      updateRemaining();
    }, UPDATE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [targetEpoch]);

  const label = useMemo(() => {
    if (targetEpoch === null) {
      return fallbackLabel;
    }

    if (msRemaining === null) {
      return targetEpoch <= initialCurrentEpoch ? "Now" : fallbackLabel;
    }

    if (msRemaining <= 0) {
      return "Now";
    }

    return `${prefix}${formatRealCountdownMs(msRemaining)}${suffix}`;
  }, [
    fallbackLabel,
    initialCurrentEpoch,
    msRemaining,
    prefix,
    suffix,
    targetEpoch,
  ]);

  return <>{label}</>;
}
