import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "./constants";

/**
 * Returns the hour index within the game week (0–6)
 */
export function getHourInWeek(epochHours: number): number {
  return epochHours % SHOW_WEEK_HOURS;
}

/**
 * Returns the hour index within the game year (0–364)
 */
export function getHourInYear(epochHours: number): number {
  return epochHours % SHOW_YEAR_HOURS;
}

/**
 * Calculate dog age in game hours
 */
export function ageHours(now: Date, birthAt: Date): number {
  const diff = now.getTime() - birthAt.getTime();
  return Math.floor(diff / (1000 * 60 * 60));
}