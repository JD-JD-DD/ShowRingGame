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
export const ENTRY_FEE_PER_SHOW = 1;

/**
 * Flat handler fee applied when 4 or more dogs are entered in the cluster.
 *
 * V1 rule:
 * - 1 to 3 dogs = no handler fee
 * - 4+ dogs = handler fee applies
 */
export const CLUSTER_HANDLER_FEE = 10;

/**
 * Number of dogs at which handler fee begins.
 */
export const HANDLER_THRESHOLD_DOGS = 4;

// TBD
// handler cost from 4 - 7, 8 - 11, 12 - 15, 16 - 19. Is it locked at 20?
 