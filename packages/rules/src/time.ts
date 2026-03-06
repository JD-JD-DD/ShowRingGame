import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "../constants/time.constants";


export function getHourInWeek(epochHour: number): number {
  return epochHour % SHOW_WEEK_HOURS;
}

export function getHourInYear(epochHour: number): number {
  return epochHour % SHOW_YEAR_HOURS;
}

export function getYearNumber(epochHour: number): number {
  return Math.floor(epochHour / SHOW_YEAR_HOURS);
}

export function ageHours(currentEpoch: number, birthEpoch: number): number {
  return currentEpoch - birthEpoch;
}