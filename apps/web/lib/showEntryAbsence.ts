import type { ShowEntryAbsenceReason } from "@prisma/client";

export function formatShowEntryAbsenceReason(
  reason: ShowEntryAbsenceReason | null | undefined
): string | null {
  switch (reason) {
    case "PREGNANT_AT_SHOW":
      return "This bitch was pregnant at show time.";
    case "POST_WHELP_REST_AT_SHOW":
      return "This bitch was still in post-whelp rest at show time.";
    case "DECEASED_BEFORE_SHOW":
      return "This dog died before judging.";
    case "UNDER_MINIMUM_SHOW_AGE":
      return "This dog was too young to compete at show time.";
    case "OVER_MAXIMUM_SHOW_AGE":
      return "This dog was above the maximum show age at show time.";
    case "OWNERSHIP_CHANGED":
      return "This dog was no longer owned by the entering kennel at show time.";
    case "LIFECYCLE_UNAVAILABLE":
      return "This dog was unavailable to compete at show time.";
    default:
      return null;
  }
}

export function formatShowEntryStatusShortLabel(args: {
  entryStatus: string;
  absenceReason?: ShowEntryAbsenceReason | null;
}): string {
  if (args.entryStatus === "ABSENT") {
    return "Absent";
  }

  switch (args.entryStatus) {
    case "ENTERED":
      return "Entered";
    case "WITHDRAWN":
      return "Withdrawn";
    case "INELIGIBLE":
      return "Ineligible";
    case "JUDGED":
      return "Judged";
    default:
      return "Status unavailable";
  }
}
