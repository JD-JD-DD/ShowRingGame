import { TRAIT_KEYS, type TraitKey } from "../constants/genetics.constants";
import { CATEGORY_TRAIT_MAP, GENETIC_JUDGING_CATEGORIES, type GeneticJudgingCategory } from "../constants/judging.constants";

export type NormalizedBreedTraitWeights = Record<TraitKey, number>;
export type BreedConformationCategoryWeights = Record<GeneticJudgingCategory, number>;

const NORMALIZED_TOTAL_TOLERANCE = 1e-9;

function validateNormalizedWeights(weights: NormalizedBreedTraitWeights) {
  let total = 0;
  for (const trait of TRAIT_KEYS) {
    const value = weights[trait];
    if (!Number.isFinite(value) || value < 0) throw new Error(`Normalized breed trait weight ${trait} must be finite and >= 0.`);
    total += value;
  }
  if (total <= 0 || Math.abs(total - 1) > NORMALIZED_TOTAL_TOLERANCE) {
    throw new Error(`Normalized breed trait weights must total 1.0 ± ${NORMALIZED_TOTAL_TOLERANCE}; got ${total}.`);
  }
}

/** Raw overlap-aware allocations; conservation must hold before final normalization. */
export function deriveRawBreedConformationCategoryWeights(weights: NormalizedBreedTraitWeights): BreedConformationCategoryWeights {
  validateNormalizedWeights(weights);
  const result = Object.fromEntries(GENETIC_JUDGING_CATEGORIES.map((category) => [category, 0])) as BreedConformationCategoryWeights;
  for (const trait of TRAIT_KEYS) {
    const mappedCategories = GENETIC_JUDGING_CATEGORIES.filter((category) => CATEGORY_TRAIT_MAP[category].includes(trait));
    if (mappedCategories.length === 0) throw new Error(`Trait ${trait} has no conformation judging-category mapping.`);
    const allocation = weights[trait] / mappedCategories.length;
    for (const category of mappedCategories) result[category] += allocation;
  }
  return result;
}

/**
 * Converts validated normalized ten-trait breed emphasis into a normalized
 * five-category conformation vector. CONDITIONING_HANDLING is excluded by
 * construction because only GENETIC_JUDGING_CATEGORIES are considered.
 */
export function deriveBreedConformationCategoryWeights(weights: NormalizedBreedTraitWeights): BreedConformationCategoryWeights {
  const raw = deriveRawBreedConformationCategoryWeights(weights);
  const total = GENETIC_JUDGING_CATEGORIES.reduce((sum, category) => sum + raw[category], 0);
  if (!Number.isFinite(total) || total <= 0 || Math.abs(total - 1) > NORMALIZED_TOTAL_TOLERANCE) {
    throw new Error(`Overlap-aware conformation allocation must conserve normalized source weight; got ${total}.`);
  }
  return Object.fromEntries(GENETIC_JUDGING_CATEGORIES.map((category) => [category, raw[category] / total])) as BreedConformationCategoryWeights;
}
