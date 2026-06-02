// genetic system - What traits exist and their limits.

export const GENETIC_TRAIT_COUNT = 10 // private

export const TRAIT_MIN = 0
export const TRAIT_MAX = 20
export const TRAIT_IDEAL = 10


export const TRAIT_VARIANCE = 1.1
export const MUTATION_RATE = 0.02

// COI beta tuning. These are intentionally separate from true mutation.
export const COI_CALCULATION_MAX_GENERATIONS = 8
export const COI_FAULT_EXPRESSION_BASELINE_PERCENT = 6.25
export const COI_FAULT_EXPRESSION_MULTIPLIER = 0.32
export const COI_MAX_FAULT_EXPRESSION_RATE = 0.12
export const COI_VARIANCE_REDUCTION_MULTIPLIER = 0.7
export const COI_MAX_VARIANCE_REDUCTION = 0.35

// ===============================
// Trait Definitions
// ===============================

export const TRAIT_KEYS = [
  "head",
  "forequarters",
  "hindquarters",
  "gait",
  "coat",
  "size",
  "temperament",
  "show_shine",
  "feet",
  "topline",
] as const

export type TraitKey = typeof TRAIT_KEYS[number]
