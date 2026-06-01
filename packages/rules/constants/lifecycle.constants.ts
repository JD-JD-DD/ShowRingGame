// 1 game hour = 1 real day
import { SHOW_YEAR_HOURS, SHOW_WEEK_HOURS } from "./time.constants";


// aging
export const AGE_DEATH_START_HOURS = 2880
export const AGE_DEATH_GUARANTEED_HOURS = 12 * SHOW_YEAR_HOURS
export const ACCIDENT_ILLNESS_LIFETIME_DEATH_RATE = 0.05


// show eligibility
export const MAX_SHOW_AGE_HOURS = 3840 
export const MIN_SHOW_AGE_HOURS = 182
export const VETERAN_START_HOURS = 3240


// Reproduction
export const MIN_BREED_AGE_HOURS = 2 * SHOW_YEAR_HOURS;
export const GESTATION_HOURS = 8 * SHOW_WEEK_HOURS; // 56 days
export const PREG_CHECK_HOURS = 4 * SHOW_WEEK_HOURS; // 28 days
export const DAM_MAX_BREED_AGE_HOURS = 7 * SHOW_YEAR_HOURS; // 7 years
export const WHELPING_COOLDOWN_HOURS = 270  // ~9 months 
export const WHELPING_DAM_DEATH_RATE = 0.03

// puppies
export const PUPPY_SALE_MIN_AGE_HOURS = 56 // 8 weeks
export const PUPPY_REHOME_PAYOUT_MAX_AGE_HOURS = MIN_SHOW_AGE_HOURS // ~6 months
export const NEONATAL_PUPPY_DEATH_RATE = 0.07
export const NEONATAL_PUPPY_DEATH_WINDOW_HOURS = SHOW_WEEK_HOURS
