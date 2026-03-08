// how traits are interpreted in the show ring

import type { TraitKey } from "./genetics.constants";

// ===============================
// Judging Categories
// ===============================

export const JUDGING_CATEGORIES = [
  "TYPE_EXPRESSION",
  "STRUCTURE_BALANCE",
  "MOVEMENT",
  "COAT_PRESENTATION",
  "TEMPERAMENT_RING_BEHAVIOR",
  "CONDITIONING_HANDLING",
] as const;

export type JudgingCategory = typeof JUDGING_CATEGORIES[number];

export const JUDGING_CATEGORY_COUNT = JUDGING_CATEGORIES.length;

// ===============================
// Trait → Category Mapping
// ===============================

// Used by deriveShowCharacteristics()

export const CATEGORY_TRAIT_MAP: Record<JudgingCategory, readonly TraitKey[]> = {
  TYPE_EXPRESSION: ["head", "size", "show_shine"],

  STRUCTURE_BALANCE: [
    "forequarters",
    "hindquarters",
    "topline",
    "feet",
  ],

  MOVEMENT: [
    "gait",
    "hindquarters",
    "forequarters",
  ],

  COAT_PRESENTATION: [
    "coat",
    "show_shine",
  ],

  TEMPERAMENT_RING_BEHAVIOR: [
    "temperament",
    "show_shine",
  ],

  // for now this stays partly genetic,
  // later training/handling/session data can be added on top
  CONDITIONING_HANDLING: [
    "show_shine",
  ],
};

// ===============================
// Default Category Weights
// ===============================

// Used if judge has no bias

export const DEFAULT_CATEGORY_WEIGHTS: Record<JudgingCategory, number> = {
  TYPE_EXPRESSION: 1.0,
  STRUCTURE_BALANCE: 1.0,
  MOVEMENT: 1.0,
  COAT_PRESENTATION: 1.0,
  TEMPERAMENT_RING_BEHAVIOR: 1.0,
  CONDITIONING_HANDLING: 1.0,
};

// ===============================
// Judge Influence
// ===============================

// How strongly a judge can bias a category

export const JUDGE_WEIGHT_VARIATION = 0.25
// meaning a judge could weight something
// between 0.75 and 1.25 of default

// ===============================
// Ring Variability
// ===============================

// Small day-to-day performance variance

export const DOG_DAY_VARIANCE = 0.05
// ±5%

// Small randomness in ring outcome

export const RING_RANDOMNESS = 0.03
// ±3%

// ===============================
// Breed Essential System
// ===============================

// Only applied in some breeds later

export const BREED_ESSENTIAL_MAX = 1;
export const BREED_ESSENTIAL_BONUS = 0.05;
export const BREED_ESSENTIAL_PENALTY = -0.1;