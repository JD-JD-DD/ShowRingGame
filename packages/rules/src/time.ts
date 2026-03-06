import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "../constants/time.constants";

/**
 * Returns the hour index within the game week (0–6)
 */
export function getHourInWeek(epochHour: number): number {
  return epochHour % SHOW_WEEK_HOURS;
}

/**
 * Returns the hour index within the game year (0–364)
 */
export function getHourInYear(epochHour: number): number {
  return epochHour % SHOW_YEAR_HOURS;
}

/**
 * Returns the current simulation year number.
 */
export function getYearNumber(epochHour: number): number {
  return Math.floor(epochHour / SHOW_YEAR_HOURS);
}

/**
 * Returns age in game hours.
 */
export function ageHours(currentEpoch: number, birthEpoch: number): number {
  return currentEpoch - birthEpoch;
}

/**
 * Returns current simulation epoch hour.
 *
 * 1 real hour = 1 game day = 1 game hour.
 */
export function getCurrentEpoch(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / (1000 * 60 * 60));
}