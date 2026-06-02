// Litter sizes center on 8 puppies and become progressively less likely
// as they move toward the supported 2-14 puppy range.
export const MIN_LITTER_SIZE = 2;
export const DEFAULT_LITTER_SIZE = 8;
export const MAX_LITTER_SIZE = 14;

/**
 * Probability bands for a litter's distance from the default size.
 *
 * A separate sign roll decides whether a non-zero offset is added or
 * subtracted. Keeping these values in the constants layer makes the
 * distribution visible without mixing it into litter creation logic.
 */
export const LITTER_SIZE_OFFSET_BANDS = [
  { upperBoundExclusive: 0.45, offsetMagnitude: 0 },
  { upperBoundExclusive: 0.625, offsetMagnitude: 1 },
  { upperBoundExclusive: 0.75, offsetMagnitude: 2 },
  { upperBoundExclusive: 0.85, offsetMagnitude: 3 },
  { upperBoundExclusive: 0.925, offsetMagnitude: 4 },
  { upperBoundExclusive: 0.975, offsetMagnitude: 5 },
  { upperBoundExclusive: 1, offsetMagnitude: 6 },
] as const;

export const LITTER_SIZE_NEGATIVE_OFFSET_RATE = 0.5;
