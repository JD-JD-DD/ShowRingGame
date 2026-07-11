const GAME_AGE_WEEK_HOURS = 7;
const GAME_AGE_YEAR_HOURS = 365;

const REAL_DAY_HOURS = 24;
const REAL_WEEK_HOURS = 7 * REAL_DAY_HOURS;
const REAL_YEAR_HOURS = 365 * REAL_DAY_HOURS;
const MINUTE_MS = 60 * 1000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

function clampWholeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.ceil(value));
}

function pluralUnit(value: number, unit: string): string {
  return `${value}${unit}`;
}

export function formatDogAge(ageHours: number): string {
  const age = clampWholeNumber(ageHours);

  if (age < GAME_AGE_WEEK_HOURS) {
    return pluralUnit(age, "d");
  }

  const years = Math.floor(age / GAME_AGE_YEAR_HOURS);
  const weeks = Math.floor((age % GAME_AGE_YEAR_HOURS) / GAME_AGE_WEEK_HOURS);

  if (years <= 0) {
    return pluralUnit(weeks, "w");
  }

  return weeks > 0
    ? `${pluralUnit(years, "y")} ${pluralUnit(weeks, "w")}`
    : pluralUnit(years, "y");
}

export function formatGameCountdownHours(hours: number): string {
  const remaining = clampWholeNumber(hours);

  if (remaining <= 0) {
    return "Now";
  }

  if (remaining < REAL_WEEK_HOURS) {
    const days = Math.floor(remaining / REAL_DAY_HOURS);
    const hoursLeft = remaining % REAL_DAY_HOURS;

    if (days <= 0) {
      return pluralUnit(hoursLeft, "h");
    }

    return hoursLeft > 0
      ? `${pluralUnit(days, "d")} ${pluralUnit(hoursLeft, "h")}`
      : pluralUnit(days, "d");
  }

  if (remaining < REAL_YEAR_HOURS) {
    const weeks = Math.floor(remaining / REAL_WEEK_HOURS);
    const days = Math.floor((remaining % REAL_WEEK_HOURS) / REAL_DAY_HOURS);

    return days > 0
      ? `${pluralUnit(weeks, "w")} ${pluralUnit(days, "d")}`
      : pluralUnit(weeks, "w");
  }

  const years = Math.floor(remaining / REAL_YEAR_HOURS);
  const weeks = Math.floor((remaining % REAL_YEAR_HOURS) / REAL_WEEK_HOURS);

  return weeks > 0
    ? `${pluralUnit(years, "y")} ${pluralUnit(weeks, "w")}`
    : pluralUnit(years, "y");
}

export function formatGameDurationHoursLong(hours: number): string {
  const remainingDays = clampWholeNumber(hours);

  if (remainingDays <= 0) {
    return "0 days";
  }

  if (remainingDays < GAME_AGE_WEEK_HOURS) {
    return `${remainingDays} ${remainingDays === 1 ? "day" : "days"}`;
  }

  if (remainingDays < GAME_AGE_YEAR_HOURS) {
    const weeks = Math.floor(remainingDays / GAME_AGE_WEEK_HOURS);
    const days = remainingDays % GAME_AGE_WEEK_HOURS;

    if (days <= 0) {
      return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
    }

    return `${weeks} ${weeks === 1 ? "week" : "weeks"}, ${days} ${
      days === 1 ? "day" : "days"
    }`;
  }

  const years = Math.floor(remainingDays / GAME_AGE_YEAR_HOURS);
  const daysAfterYears = remainingDays % GAME_AGE_YEAR_HOURS;
  const weeks = Math.floor(daysAfterYears / GAME_AGE_WEEK_HOURS);

  if (weeks <= 0) {
    return `${years} ${years === 1 ? "year" : "years"}`;
  }

  return `${years} ${years === 1 ? "year" : "years"}, ${weeks} ${
    weeks === 1 ? "week" : "weeks"
  }`;
}

export function formatShortCountdownHours(hours: number): string {
  const remaining = clampWholeNumber(hours);

  if (remaining <= 0) {
    return "Now";
  }

  if (remaining < REAL_DAY_HOURS) {
    return pluralUnit(remaining, "h");
  }

  const days = Math.floor(remaining / REAL_DAY_HOURS);
  const hoursLeft = remaining % REAL_DAY_HOURS;

  return hoursLeft > 0
    ? `${pluralUnit(days, "d")} ${pluralUnit(hoursLeft, "h")}`
    : pluralUnit(days, "d");
}

export function formatRealCountdownMs(msRemaining: number): string {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) {
    return "Now";
  }

  const totalMinutes = Math.ceil(msRemaining / MINUTE_MS);

  if (totalMinutes < HOUR_MINUTES) {
    return pluralUnit(totalMinutes, "m");
  }

  const days = Math.floor(totalMinutes / DAY_MINUTES);
  const hours = Math.floor((totalMinutes % DAY_MINUTES) / HOUR_MINUTES);
  const minutes = totalMinutes % HOUR_MINUTES;

  if (days > 0) {
    return `${pluralUnit(days, "d")} ${pluralUnit(hours, "h")} ${pluralUnit(
      minutes,
      "m"
    )}`;
  }

  return `${pluralUnit(hours, "h")} ${pluralUnit(minutes, "m")}`;
}
