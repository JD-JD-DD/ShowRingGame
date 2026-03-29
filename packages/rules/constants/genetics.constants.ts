// genetic system - What traits exist and their limits.

export const GENETIC_TRAIT_COUNT = 10 // private

export const TRAIT_MIN = 0
export const TRAIT_MAX = 20
export const TRAIT_IDEAL = 10


export const TRAIT_VARIANCE = 2
export const INHERITANCE_WEIGHT = 0.25
export const MUTATION_RATE = 0.02

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
