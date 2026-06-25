import { formatShortCountdownHours } from "@/lib/gameTimeFormat";
import type { ShowDisplayStatus } from "@/server/services/showAvailability.service";

export type ShowCountdownTone =
  | "ready"
  | "pending"
  | "closed"
  | "judging"
  | "published"
  | "cancelled"
  | "neutral";

export type ShowCountdownCard = {
  label: string;
  value: string;
  shortValue: string;
  tone: ShowCountdownTone;
  targetEpoch: number | null;
};

export type ShowCountdownDayInput = {
  scheduledEpoch: number;
  status: string;
  publishedAtEpoch: number | null;
  resultCount?: number;
};

export type BuildShowCountdownsInput = {
  currentEpoch: number;
  clusterId: string;
  clusterStatus: string;
  displayStatus: ShowDisplayStatus;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  startEpoch: number;
  resultCount: number;
  hasJudgingActivity: boolean;
  showDays: ShowCountdownDayInput[];
};

export type ShowCountdownSummary = {
  entryClose: ShowCountdownCard;
  judging: ShowCountdownCard;
  statusLabel: ShowDisplayStatus;
  rowMetaLabel: string | null;
};

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase();
}

function remainingHours(targetEpoch: number, currentEpoch: number): number {
  return Math.max(0, targetEpoch - currentEpoch);
}

function formatUntil(
  prefix: string,
  targetEpoch: number,
  currentEpoch: number
): string {
  return `${prefix} in ${formatShortCountdownHours(
    remainingHours(targetEpoch, currentEpoch)
  )}.`;
}

function compactUntil(
  prefix: string,
  targetEpoch: number,
  currentEpoch: number
): string {
  return `${prefix} in ${formatShortCountdownHours(
    remainingHours(targetEpoch, currentEpoch)
  )}`;
}

function hasPublishedResults(input: BuildShowCountdownsInput): boolean {
  return (
    input.resultCount > 0 ||
    input.showDays.some((day) => {
      const status = normalizeStatus(day.status);

      return (
        status === "RESULTS_PUBLISHED" ||
        day.publishedAtEpoch !== null ||
        (day.resultCount ?? 0) > 0
      );
    })
  );
}

function nextFutureJudgingEpoch(
  input: BuildShowCountdownsInput
): number | null {
  const futureDayEpochs = input.showDays
    .map((day) => day.scheduledEpoch)
    .filter((epoch) => epoch > input.currentEpoch)
    .sort((a, b) => a - b);

  if (futureDayEpochs[0] !== undefined) {
    return futureDayEpochs[0];
  }

  return input.startEpoch > input.currentEpoch ? input.startEpoch : null;
}

function buildEntryCloseCard(
  input: BuildShowCountdownsInput
): ShowCountdownCard {
  switch (input.displayStatus) {
    case "SCHEDULED":
      return {
        label: "Entry Window",
        value: formatUntil(
          "Entries open",
          input.entryOpenEpoch,
          input.currentEpoch
        ),
        shortValue: compactUntil("opens", input.entryOpenEpoch, input.currentEpoch),
        tone: "pending",
        targetEpoch: input.entryOpenEpoch,
      };
    case "OPEN":
      return {
        label: "Entry Window",
        value: formatUntil(
          "Entries close",
          input.entryCloseEpoch,
          input.currentEpoch
        ),
        shortValue: compactUntil(
          "closes",
          input.entryCloseEpoch,
          input.currentEpoch
        ),
        tone: "ready",
        targetEpoch: input.entryCloseEpoch,
      };
    case "CANCELLED":
      return {
        label: "Entry Window",
        value: "Show cancelled.",
        shortValue: "cancelled",
        tone: "cancelled",
        targetEpoch: null,
      };
    case "JUDGED":
      return {
        label: "Entry Window",
        value: hasPublishedResults(input) ? "Results available." : "Judged.",
        shortValue: hasPublishedResults(input) ? "results available" : "judged",
        tone: "published",
        targetEpoch: null,
      };
    case "JUDGING":
      return {
        label: "Entry Window",
        value: "Entries locked.",
        shortValue: "entries locked",
        tone: "judging",
        targetEpoch: null,
      };
    case "AWAITING JUDGING":
    case "CLOSED":
      return {
        label: "Entry Window",
        value: "Entries closed.",
        shortValue: "entries closed",
        tone: "closed",
        targetEpoch: null,
      };
  }
}

function buildJudgingCard(input: BuildShowCountdownsInput): ShowCountdownCard {
  const judgingEpoch = nextFutureJudgingEpoch(input);

  switch (input.displayStatus) {
    case "CANCELLED":
      return {
        label: "Judging",
        value: "Show cancelled.",
        shortValue: "cancelled",
        tone: "cancelled",
        targetEpoch: null,
      };
    case "JUDGED":
      return {
        label: "Judging",
        value: hasPublishedResults(input) ? "Results available." : "Judged.",
        shortValue: hasPublishedResults(input) ? "results available" : "judged",
        tone: "published",
        targetEpoch: null,
      };
    case "JUDGING":
      return {
        label: "Judging",
        value: "Judging now.",
        shortValue: "judging now",
        tone: "judging",
        targetEpoch: null,
      };
    case "AWAITING JUDGING":
      return {
        label: "Judging",
        value: "Awaiting judging.",
        shortValue: "awaiting judging",
        tone: "pending",
        targetEpoch: null,
      };
    case "SCHEDULED":
    case "OPEN":
    case "CLOSED":
      if (judgingEpoch !== null) {
        return {
          label: "Judging",
          value: formatUntil("Judging starts", judgingEpoch, input.currentEpoch),
          shortValue: compactUntil("judges", judgingEpoch, input.currentEpoch),
          tone: "pending",
          targetEpoch: judgingEpoch,
        };
      }

      return {
        label: "Judging",
        value: "Judging pending.",
        shortValue: "judging pending",
        tone: "neutral",
        targetEpoch: null,
      };
  }
}

function buildRowMetaLabel(input: BuildShowCountdownsInput): string | null {
  const judgingEpoch = nextFutureJudgingEpoch(input);

  switch (input.displayStatus) {
    case "SCHEDULED":
      return compactUntil("Entries open", input.entryOpenEpoch, input.currentEpoch);
    case "OPEN": {
      const entryLabel = compactUntil(
        "Entries close",
        input.entryCloseEpoch,
        input.currentEpoch
      );
      const judgingLabel =
        judgingEpoch !== null
          ? compactUntil("Judges", judgingEpoch, input.currentEpoch)
          : null;

      return judgingLabel ? `${entryLabel} · ${judgingLabel}` : entryLabel;
    }
    case "CLOSED":
      return judgingEpoch !== null
        ? `Entries closed · ${compactUntil(
            "Judges",
            judgingEpoch,
            input.currentEpoch
          )}`
        : "Entries closed";
    case "AWAITING JUDGING":
      return "Awaiting judging";
    case "JUDGING":
      return input.hasJudgingActivity ? "Judging now" : "Judging";
    case "JUDGED":
      return hasPublishedResults(input) ? "Results available" : "Judged";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function buildShowCountdowns(
  input: BuildShowCountdownsInput
): ShowCountdownSummary {
  return {
    entryClose: buildEntryCloseCard(input),
    judging: buildJudgingCard(input),
    statusLabel: input.displayStatus,
    rowMetaLabel: buildRowMetaLabel(input),
  };
}
