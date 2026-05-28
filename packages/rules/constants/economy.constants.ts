// market floor values
// minimum value for forever homed puppy
export const FLOOR_PUPPY_PRICE = 100


// travel costs
export const BASE_TRAVEL_COST: Record<number, number> = {
  0: 0,
  1: 100,
  2: 200,
  3: 400,
  4: 700,
  5: 1200,
  6: 2000,
  7: 3500,
};

export const TRAVEL_COST_PER_DOG = 50;

// TBD
export const ENTRY_FEE = 0 // TBD
export const HANDLER_FEE = 0 // TBD
export const KENNEL_RUN_COST = 0 // TBD
export const TRAVEL_COST_MULTIPLIER = 0 // TBD

/**
 * Flat entry fee charged for each dog entered in each individual show.
 *
 * Example:
 * 1 dog entered on 3 cluster days = 3 entries
 */
export const ENTRY_FEE_PER_SHOW = 25;

/**
 * Flat fee charged when a player creates an in-kennel breeding.
 *
 * Public stud service fees will be separate and paid to the stud dog's owner.
 */
export const BREEDING_FEE = 500;

/**
 * Ringside handler fee charged per dog over the owner-handled limit for a
 * breed at the primary show.
 */
export const CLUSTER_HANDLER_FEE = 100;
export const RINGSIDE_HANDLER_FEE = CLUSTER_HANDLER_FEE;
export const TRAVELING_HANDLER_FEE = RINGSIDE_HANDLER_FEE * 5;

/**
 * Owner-handled breed limit. Dogs 1-3 of a breed do not require handlers.
 */
export const HANDLER_THRESHOLD_DOGS = 4;
export const OWNER_HANDLED_DOG_LIMIT_PER_BREED = HANDLER_THRESHOLD_DOGS - 1;

// TBD
// handler cost from 4 - 7, 8 - 11, 12 - 15, 16 - 19. Is it locked at 20?
 
