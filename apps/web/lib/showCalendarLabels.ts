import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "@showring/rules";

const SHOW_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function formatShowCalendarLabel(epoch: number): string {
  const year = Math.floor(epoch / SHOW_YEAR_HOURS) + 1;
  const hourInYear = epoch % SHOW_YEAR_HOURS;
  const showCalendarHourInYear = Math.min(hourInYear, SHOW_YEAR_HOURS - 2);
  const weekInYear =
    Math.floor(showCalendarHourInYear / SHOW_WEEK_HOURS) + 1;
  const dayInWeek = showCalendarHourInYear % SHOW_WEEK_HOURS;
  const dayName = SHOW_DAY_NAMES[dayInWeek] ?? "Show Day";

  return `${dayName} — Week ${weekInYear}, Year ${year}`;
}
