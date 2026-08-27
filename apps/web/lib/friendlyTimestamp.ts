const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export function formatFriendlyTimestamp(
  value: Date,
  options: { now?: Date; locale?: string } = {}
): string {
  const now = options.now ?? new Date();
  const elapsedMs = Math.max(0, now.getTime() - value.getTime());

  if (elapsedMs < MINUTE_MS) return "Just now";

  if (elapsedMs < HOUR_MS) {
    const minutes = Math.floor(elapsedMs / MINUTE_MS);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  if (elapsedMs < DAY_MS) {
    const hours = Math.floor(elapsedMs / HOUR_MS);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  if (elapsedMs < WEEK_MS) {
    const days = Math.floor(elapsedMs / DAY_MS);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  const includeYear = value.getFullYear() !== now.getFullYear();
  return new Intl.DateTimeFormat(options.locale, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(value);
}
