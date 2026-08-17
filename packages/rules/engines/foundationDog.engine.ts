import {
  CURRENT_GENETICS_VERSION,
  LOCI_PER_TRAIT,
  TOTAL_LOCI,
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  type TraitKey,
} from "../constants/genetics.constants";
import { calculatePhenotypeFromGenotype, encodeGenotype, type CanonicalGenotype } from "./genotype.engine";
import {
  CATEGORY_TRAIT_MAP,
  GENETIC_JUDGING_CATEGORIES,
  type GeneticJudgingCategory,
  type JudgingCategory,
} from "../constants/judging.constants";
import type { Dog, DogTraits } from "./dog.engine";
import type { Sex } from "../src/lifecycle";
import {
  allValuesExactlyIdeal,
  averageIdealDistance,
  averageIdealScore,
  countValuesNearIdeal,
  scoreValueAgainstIdeal,
} from "./idealScoring.engine";
import { aggregateDirectionalCategory } from "./directionalCategory.engine";

export type VisibleCategories = {
  typeExpression: number;
  structureBalance: number;
  movement: number;
  coatPresentation: number;
  temperamentRingBehavior: number;
  conditioningHandling: number;
};

export type FoundationQualityBand =
  | "STANDARD_FOUNDATION"
  | "NICE_FOUNDATION"
  | "ROUGH_FOUNDATION";

export type FoundationBreedBaseline = {
  breedCode2: string;
  traitMeans: DogTraits;
};

export type CreateFoundationDogEngineInput = {
  dogId: string;
  regNumber: string;
  breedCode2: string;
  birthEpoch: number;
  sex?: Sex;
  callName: string;
  breedBaseline: FoundationBreedBaseline;
  /** Server-resolved contemporary evidence; rules never query population state. */
  populationContext?: FoundationPopulationContextInput;
  random01?: () => number;
};

export type FoundationContextSource = {
  mode: "LIVE" | "RETAINED_BASELINE" | "RESET_FALLBACK";
  snapshotId: string | null;
  gameYear: number | null;
  snapshotEpoch: number | null;
  rulesVersion: string | null;
  sourceFingerprint: string | null;
  eligibleDogCount: number;
  kennelCount: number;
};

export type FoundationPhenotypeTraitContext = {
  center: number;
  variance: number;
  meanAbsoluteDeviation: number;
  min: number;
  max: number;
  belowCount: number;
  exactCount: number;
  aboveCount: number;
  belowCenter: number | null;
  aboveCenter: number | null;
  belowShare: number;
  aboveShare: number;
  nearIdealShare: number;
};

export type FoundationPhenotypeContext = {
  source: FoundationContextSource;
  traits: Partial<Record<TraitKey, FoundationPhenotypeTraitContext>> | null;
};

export type FoundationLocusDiversityContext = {
  locus: number;
  components: Array<{ component: string; share: number }>;
  dominantShare: number;
  effectiveComponentCount: number;
  homozygosity: number;
  classification: "DIVERSE" | "NEAR_FIXED" | "EFFECTIVELY_FIXED";
};

export type FoundationGeneticDiversityContext = {
  source: FoundationContextSource;
  payloadVersion: string | null;
  componentBinWidth: number | null;
  overallMeanHomozygosity: number | null;
  fixedLocusCount: number | null;
  nearFixedLocusCount: number | null;
  loci: FoundationLocusDiversityContext[] | null;
};

export type FoundationPopulationContextInput = {
  phenotypeContext: FoundationPhenotypeContext;
  geneticDiversityContext: FoundationGeneticDiversityContext;
};

export function createResetFoundationPopulationContext(): FoundationPopulationContextInput {
  const source: FoundationContextSource = { mode: "RESET_FALLBACK", snapshotId: null, gameYear: null, snapshotEpoch: null, rulesVersion: null, sourceFingerprint: null, eligibleDogCount: 0, kennelCount: 0 };
  return {
    phenotypeContext: { source, traits: null },
    geneticDiversityContext: { source, payloadVersion: null, componentBinWidth: null, overallMeanHomozygosity: null, fixedLocusCount: null, nearFixedLocusCount: null, loci: null },
  };
}
/** GEN-09C calibration: internal generation analysis, never a player-visible tier. */
export const FOUNDATION_OPPORTUNITY_TARGETS = {
  ZERO: 0.83,
  ONE: 0.15,
  TWO: 0.02,
  /** Bounded contemporary component mixture; the remainder is broad calibrated sampling. */
  POPULATION_COMPONENT_MIX: 0.3,
  /** A selected opportunity only weakly biases a component draw. */
  TARGET_ALTERNATIVE_BIAS: 0.2,
  /** Selected low-frequency identities may sample one valid conspicuous diploid component pair. */
  TARGETED_LOW_FREQUENCY_DIPLOID_MIX: 0.7,
  /** Composite scarcity evidence remains a weak bias, not a multi-locus repair signal. */
  TARGETED_COMPOSITE_SCARCITY_DIPLOID_MIX: 0.05,
  /** Symmetric directional evidence: one side dominates while the other is scarce. */
  DIRECTIONAL_SCARCITY_DOMINANT_SHARE: 0.65,
  DIRECTIONAL_SCARCITY_OPPOSITE_MAX_SHARE: 0.2,
  LOW_FREQUENCY_COMPONENT_MAX_SHARE: 0.1,
  /** Observed opportunity requires a diploid result in one conspicuously rare v2 component bin. */
  CONSPICUOUS_COMPONENT_MAX_SHARE: 0.1,
  CONSPICUOUS_COMPONENT_MIN_ALLELE_COPIES: 2,
} as const;

export type OpportunityReason =
  | "OPPOSITE_DIRECTION_SCARCITY"
  | "LOW_FREQUENCY_COMPONENT"
  | "NEAR_FIXED_LOCUS_DIVERSITY"
  | "EFFECTIVELY_FIXED_LOCUS_DIVERSITY";

export type FoundationOpportunityIdentity = {
  trait: TraitKey;
  locus: number;
  reasons: OpportunityReason[];
};

export type FoundationGeneticsAnalysis = {
  eligibleScarcityIdentities: FoundationOpportunityIdentity[];
  opportunityTargetCount: 0 | 1 | 2;
  targetedOpportunityIdentities: FoundationOpportunityIdentity[];
  observedOpportunityIdentities: FoundationOpportunityIdentity[];
  observedOpportunityCount: number;
};

type LocusEvidence = {
  locus: number;
  classification: "DIVERSE" | "NEAR_FIXED" | "EFFECTIVELY_FIXED";
  components: Array<{ component: string; share: number }>;
};
type TraitEvidence = { belowShare: number; aboveShare: number; nearIdealShare: number };
type OpportunityCandidate = FoundationOpportunityIdentity & { direction: -1 | 0 | 1 };

/** GEN-09C ordinary-import calibration; deliberately separate from GEN-06E reset founders. */
export const ORDINARY_IMPORT_CALIBRATION = {
  ALLELE_SPREAD: 3.5,
  MAX_CANDIDATE_ATTEMPTS: 12,
  EMERGENCY_ALLELE_BOUND: 0.5,
  MAX_EXTREME_TRAITS: 1,
  MAX_BROAD_OUTLIER_TRAITS: 2,
  MAX_RELATIVE_OUTLIER_TRAITS: 2,
  MAX_MEAN_RELATIVE_DEPARTURE: 2.2,
} as const;

function contextLoci(context: FoundationPopulationContextInput | undefined): FoundationLocusDiversityContext[] {
  const loci = context?.geneticDiversityContext.loci;
  if (context?.geneticDiversityContext.source.mode === "RESET_FALLBACK" || !Array.isArray(loci)) return [];
  return loci
    .filter((value): value is FoundationLocusDiversityContext => {
      if (typeof value !== "object" || value === null) return false;
      const locus = value as LocusEvidence;
      return Number.isInteger(locus.locus) && locus.locus >= 0 && locus.locus < TOTAL_LOCI &&
        (locus.classification === "DIVERSE" || locus.classification === "NEAR_FIXED" || locus.classification === "EFFECTIVELY_FIXED") &&
        Array.isArray(locus.components) && locus.components.every(component => Number.isFinite(Number(component.component)) && Number.isFinite(component.share) && component.share >= 0);
    })
    .sort((left, right) => left.locus - right.locus);
}

function contextTraitEvidence(context: FoundationPopulationContextInput | undefined, trait: TraitKey): TraitEvidence | null {
  const value = context?.phenotypeContext.traits?.[trait];
  if (context?.phenotypeContext.source.mode === "RESET_FALLBACK" || !value) return null;
  const evidence = value as Partial<TraitEvidence>;
  return Number.isFinite(evidence.belowShare) && Number.isFinite(evidence.aboveShare) && Number.isFinite(evidence.nearIdealShare)
    ? { belowShare: evidence.belowShare!, aboveShare: evidence.aboveShare!, nearIdealShare: evidence.nearIdealShare! }
    : null;
}

function contextTraitProfile(context: FoundationPopulationContextInput | undefined, trait: TraitKey): FoundationPhenotypeTraitContext | null {
  const value = context?.phenotypeContext.traits?.[trait];
  return context?.phenotypeContext.source.mode === "RESET_FALLBACK" || !value ? null : value;
}

/** GEN-09C profile-level check: contemporary evidence bounds plausibility but never supplies a phenotype target. */
export function isOrdinaryFoundationPhenotypePlausible(input: { traits: DogTraits; populationContext?: FoundationPopulationContextInput }): boolean {
  const values = TRAIT_KEYS.map(trait => input.traits[trait]);
  const extremeTraits = values.filter(value => value < 3 || value > 17).length;
  const broadOutlierTraits = values.filter(value => value < 5 || value > 15).length;
  if (extremeTraits > ORDINARY_IMPORT_CALIBRATION.MAX_EXTREME_TRAITS || broadOutlierTraits > ORDINARY_IMPORT_CALIBRATION.MAX_BROAD_OUTLIER_TRAITS) return false;
  const relativeDepartures = TRAIT_KEYS.flatMap(trait => {
    const profile = contextTraitProfile(input.populationContext, trait);
    if (!profile) return [];
    const scale = Math.max(1, Math.sqrt(profile.variance));
    return [Math.abs(input.traits[trait] - profile.center) / scale];
  });
  if (relativeDepartures.length === 0) return true;
  const relativeOutliers = relativeDepartures.filter(value => value > 3.5).length;
  const meanRelativeDeparture = average(relativeDepartures);
  return relativeOutliers <= ORDINARY_IMPORT_CALIBRATION.MAX_RELATIVE_OUTLIER_TRAITS && meanRelativeDeparture <= ORDINARY_IMPORT_CALIBRATION.MAX_MEAN_RELATIVE_DEPARTURE;
}

function traitForLocus(locus: number): TraitKey {
  return TRAIT_KEYS[Math.floor(locus / LOCI_PER_TRAIT)]!;
}

function directionalScarcity(context: FoundationPopulationContextInput | undefined, trait: TraitKey): -1 | 0 | 1 {
  const evidence = contextTraitEvidence(context, trait);
  if (!evidence) return 0;
  if (evidence.belowShare >= FOUNDATION_OPPORTUNITY_TARGETS.DIRECTIONAL_SCARCITY_DOMINANT_SHARE && evidence.aboveShare <= FOUNDATION_OPPORTUNITY_TARGETS.DIRECTIONAL_SCARCITY_OPPOSITE_MAX_SHARE) return 1;
  if (evidence.aboveShare >= FOUNDATION_OPPORTUNITY_TARGETS.DIRECTIONAL_SCARCITY_DOMINANT_SHARE && evidence.belowShare <= FOUNDATION_OPPORTUNITY_TARGETS.DIRECTIONAL_SCARCITY_OPPOSITE_MAX_SHARE) return -1;
  return 0;
}

function componentBin(allele: number): string { return (Math.round(allele / 0.5) * 0.5).toFixed(1); }
function chooseWeighted<T>(items: readonly T[], weights: readonly number[], random01: () => number): T {
  let roll = random01() * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < items.length; index += 1) { roll -= weights[index]!; if (roll <= 0) return items[index]!; }
  return items.at(-1)!;
}

function opportunityCandidates(context: FoundationPopulationContextInput | undefined, loci: readonly LocusEvidence[]): OpportunityCandidate[] {
  return loci.map((evidence) => {
    const trait = traitForLocus(evidence.locus);
    const direction = directionalScarcity(context, trait);
    const reasons = new Set<OpportunityReason>();
    if (evidence.classification === "NEAR_FIXED") reasons.add("NEAR_FIXED_LOCUS_DIVERSITY");
    if (evidence.classification === "EFFECTIVELY_FIXED") reasons.add("EFFECTIVELY_FIXED_LOCUS_DIVERSITY");
    if (evidence.components.some(component => component.share <= FOUNDATION_OPPORTUNITY_TARGETS.LOW_FREQUENCY_COMPONENT_MAX_SHARE)) reasons.add("LOW_FREQUENCY_COMPONENT");
    if (direction !== 0 && evidence.components.some(component => Math.sign(Number(component.component)) === direction)) reasons.add("OPPOSITE_DIRECTION_SCARCITY");
    return { trait, locus: evidence.locus, reasons: [...reasons].sort(), direction };
  }).filter(candidate => candidate.reasons.length > 0);
}

/** Pure context-relative classifier; it never alters the supplied genotype. */
export function classifyFoundationOpportunities(input: { populationContext?: FoundationPopulationContextInput; genotype: CanonicalGenotype }): FoundationOpportunityIdentity[] {
  const loci = contextLoci(input.populationContext);
  const candidates = opportunityCandidates(input.populationContext, loci);
  const byLocus = new Map(candidates.map(candidate => [candidate.locus, candidate]));
  return input.genotype.loci.flatMap((alleles, locus) => {
    const candidate = byLocus.get(locus);
    const evidence = loci.find(item => item.locus === locus);
    if (!candidate || !evidence) return [];
    const binCopies = new Map<string, number>();
    alleles.map(componentBin).forEach(bin => binCopies.set(bin, (binCopies.get(bin) ?? 0) + 1));
    const dominantShare = Math.max(...evidence.components.map(component => component.share));
    const conspicuousComponents = evidence.components.filter(component =>
      component.share <= FOUNDATION_OPPORTUNITY_TARGETS.CONSPICUOUS_COMPONENT_MAX_SHARE &&
      (binCopies.get(component.component) ?? 0) >= FOUNDATION_OPPORTUNITY_TARGETS.CONSPICUOUS_COMPONENT_MIN_ALLELE_COPIES
    );
    const reasons = candidate.reasons.filter(reason => {
      if (reason === "OPPOSITE_DIRECTION_SCARCITY") return conspicuousComponents.some(component => Math.sign(Number(component.component)) === candidate.direction);
      if (reason === "LOW_FREQUENCY_COMPONENT") return conspicuousComponents.length > 0;
      return conspicuousComponents.some(component => component.share < dominantShare);
    });
    return reasons.length === 0 ? [] : [{ trait: candidate.trait, locus, reasons }];
  });
}

export type FoundationDogEngineResult = {
  dog: Dog;
  callName: string;
  qualityBand: FoundationQualityBand;
  visibleCategories: VisibleCategories;
  suggestedPrice: number;
  /** Internal/test-only GEN-09C observability; production persistence discards it. */
  geneticsAnalysis: FoundationGeneticsAnalysis;
};

const FOUNDATION_STANDARD_WEIGHT = 0.60;
const FOUNDATION_NICE_WEIGHT = 0.30;
// Remaining 0.10 => rough

const STANDARD_HIDDEN_SPREAD = 4.5;
const NICE_HIDDEN_SPREAD = 3.25;
const ROUGH_HIDDEN_SPREAD = 5.75;

const STANDARD_EXTREME_TRAIT_CHANCE = 0.1;
const NICE_EXTREME_TRAIT_CHANCE = 0.04;
const ROUGH_EXTREME_TRAIT_CHANCE = 0.18;

const EXTREME_MIN_DISTANCE = 6.5;
const EXTREME_MAX_DISTANCE = 9.25;

const TRAIT_ROLL_VARIANCE = 1.75;
const MAX_GENERATION_ATTEMPTS = 40;

const PRICE_BASE = 1800;
const PRICE_STEP = 75;

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, Math.round(value)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Returns a random number between min and max.
 */
function randomBetween(random01: () => number, min: number, max: number): number {
  return min + (max - min) * random01();
}

function pickSex(random01: () => number): Sex {
  return random01() < 0.5 ? "M" : "F";
}

function pickQualityBand(random01: () => number): FoundationQualityBand {
  const roll = random01();

  if (roll < FOUNDATION_STANDARD_WEIGHT) return "STANDARD_FOUNDATION";
  if (roll < FOUNDATION_STANDARD_WEIGHT + FOUNDATION_NICE_WEIGHT) {
    return "NICE_FOUNDATION";
  }

  return "ROUGH_FOUNDATION";
}

function getBandOffset(band: FoundationQualityBand): number {
  switch (band) {
    case "NICE_FOUNDATION":
      return NICE_HIDDEN_SPREAD;
    case "ROUGH_FOUNDATION":
      return ROUGH_HIDDEN_SPREAD;
    case "STANDARD_FOUNDATION":
    default:
      return STANDARD_HIDDEN_SPREAD;
  }
}

function getBandExtremeChance(band: FoundationQualityBand): number {
  switch (band) {
    case "NICE_FOUNDATION":
      return NICE_EXTREME_TRAIT_CHANCE;
    case "ROUGH_FOUNDATION":
      return ROUGH_EXTREME_TRAIT_CHANCE;
    case "STANDARD_FOUNDATION":
    default:
      return STANDARD_EXTREME_TRAIT_CHANCE;
  }
}

function buildTargetMeans(
  baseline: DogTraits,
  band: FoundationQualityBand,
  random01: () => number
): DogTraits {
  const target = {} as DogTraits;
  const spread = getBandOffset(band);
  const extremeChance = getBandExtremeChance(band);

  for (const traitKey of TRAIT_KEYS) {
    const ideal = 10;
    const breedMean = baseline[traitKey];
    const deviationFromIdeal = breedMean - ideal;

    // Bias toward underrepresented side of ideal
    let bias = 0;
    if (Math.abs(deviationFromIdeal) > 0.5) {
      bias = deviationFromIdeal > 0 ? -0.5 : 0.5;
    }

    let sampled: number;

    if (random01() < extremeChance) {
      const direction =
        Math.abs(deviationFromIdeal) > 0.5
          ? deviationFromIdeal > 0
            ? -1
            : 1
          : random01() < 0.5
            ? -1
            : 1;

      sampled =
        ideal +
        direction *
          randomBetween(random01, EXTREME_MIN_DISTANCE, EXTREME_MAX_DISTANCE);
    } else {
      // Sample around ideal (NOT breed mean), but with enough width that
      // hidden genotype can carry real risk behind a smoother phenotype.
      sampled =
        ideal +
        randomBetween(random01, -spread, spread) +
        bias * random01();
    }

    target[traitKey] = clampTrait(sampled);
  }

  return target;
}

// function buildTargetMeans(
//   baseline: DogTraits,
//   band: FoundationQualityBand,
//   random01: () => number
// ): DogTraits {
//   const offset = getBandOffset(band);
//   const target = {} as DogTraits;

//   for (const traitKey of TRAIT_KEYS) {
//     const ideal = 10;

//     if (baseline[traitKey] === ideal) {
//       const direction = random01() < 0.5 ? -1 : 1;
//       target[traitKey] = clampTrait(ideal + direction * offset);
//     } else if (baseline[traitKey] < ideal) {
//       target[traitKey] = clampTrait(
//         baseline[traitKey] + (random01() < 0.6 ? -offset : offset * 0.5)
//       );
//     } else {
//       target[traitKey] = clampTrait(
//         baseline[traitKey] + (random01() < 0.6 ? offset : -offset * 0.5)
//       );
//     }
//   }

//   return target;
// }

function shuffleTraitKeys(random01: () => number): TraitKey[] {
  const values = [...TRAIT_KEYS];

  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random01() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

function moveTowardIdeal(
  value: number,
  random01: () => number,
  ideal = 10
): number {
  if (value === ideal) return value;

  const delta = randomBetween(random01, 0.4, 1.1);

  if (value < ideal) {
    return clampTrait(value + delta);
  }

  return clampTrait(value - delta);
}

function moveAwayFromIdeal(
  value: number,
  random01: () => number,
  ideal = 10
): number {
  const delta = randomBetween(random01, 0.5, 1.4);

  if (value < ideal) {
    return clampTrait(value - delta);
  }

  return clampTrait(value + delta);
}

function buildTraitBiasProfile(random01: () => number): {
  closerToIdealTraits: Set<TraitKey>;
  fartherFromIdealTraits: Set<TraitKey>;
} {
  const shuffled = shuffleTraitKeys(random01);

  const closerCount = 2 + Math.floor(random01() * 3); // 2..4
  const fartherCount = 2 + Math.floor(random01() * 3); // 2..4

  const closerToIdealTraits = new Set<TraitKey>(shuffled.slice(0, closerCount));
  const fartherFromIdealTraits = new Set<TraitKey>(
    shuffled.slice(closerCount, closerCount + fartherCount)
  );

  return { closerToIdealTraits, fartherFromIdealTraits };
}

function generateCandidateTraits(
  targetMeans: DogTraits,
  random01: () => number
): DogTraits {
  const { closerToIdealTraits, fartherFromIdealTraits } =
    buildTraitBiasProfile(random01);

  const traits = {} as DogTraits;

  for (const traitKey of TRAIT_KEYS) {
    let value =
      targetMeans[traitKey] +
      randomBetween(random01, -TRAIT_ROLL_VARIANCE, TRAIT_ROLL_VARIANCE);

    if (closerToIdealTraits.has(traitKey)) {
      value = moveTowardIdeal(value, random01);
    }

    if (fartherFromIdealTraits.has(traitKey)) {
      value = moveAwayFromIdeal(value, random01);
    }

    traits[traitKey] = Number(clampTrait(value).toFixed(2));
  }

  return traits;
}


function mapCategoryKey(category: GeneticJudgingCategory): keyof VisibleCategories {
  switch (category) {
    case "TYPE_EXPRESSION":
      return "typeExpression";
    case "STRUCTURE_BALANCE":
      return "structureBalance";
    case "MOVEMENT":
      return "movement";
    case "COAT_PRESENTATION":
      return "coatPresentation";
    case "TEMPERAMENT_RING_BEHAVIOR":
      return "temperamentRingBehavior";
  }
}

/**
 * Keep this helper aligned with the judging category map.
 * Raw traits stay hidden; UI and API should use these derived values.
 *
 * IMPORTANT:
 * Visible categories remain on the same 0–20 scale as hidden traits,
 * with 10 as ideal. They preserve whether the category appears under
 * or over ideal, while still hiding the exact raw trait breakdown.
 */
export function deriveVisibleCategoriesFromTraits(
  traits: DogTraits
): VisibleCategories {
  const visibleCategories: VisibleCategories = {
    typeExpression: 0,
    structureBalance: 0,
    movement: 0,
    coatPresentation: 0,
    temperamentRingBehavior: 0,
    conditioningHandling: 0,
  };

  for (const category of GENETIC_JUDGING_CATEGORIES) {
    const traitKeys = CATEGORY_TRAIT_MAP[category];
    const values = traitKeys.map((traitKey) => traits[traitKey]);
    const score = aggregateDirectionalCategory(values);

    visibleCategories[mapCategoryKey(category)] = score;
  }

  return visibleCategories;
}

function geneticVisibleCategoryValues(
  visibleCategories: VisibleCategories
): number[] {
  return [
    visibleCategories.typeExpression,
    visibleCategories.structureBalance,
    visibleCategories.movement,
    visibleCategories.coatPresentation,
    visibleCategories.temperamentRingBehavior,
  ];
}

function countTraitsInRange(
  traits: DogTraits,
  minInclusive: number,
  maxInclusive: number
): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return value >= minInclusive && value <= maxInclusive;
  }).length;
}

function countExtremeFaultTraits(traits: DogTraits): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return value <= 3 || value >= 17;
  }).length;
}

function countPoorTraits(traits: DogTraits): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return (value >= 4 && value <= 5) || (value >= 15 && value <= 16);
  }).length;
}

function countEliteTraits(traits: DogTraits): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return value >= 9 && value <= 11;
  }).length;
}

function traitSpread(traits: DogTraits): number {
  const values = TRAIT_KEYS.map((traitKey) => traits[traitKey]);
  return Math.max(...values) - Math.min(...values);
}

function isFoundationCandidateAcceptable(traits: DogTraits): boolean {
  const visible = deriveVisibleCategoriesFromTraits(traits);
  const categoryValues = geneticVisibleCategoryValues(visible);
  const traitValues = TRAIT_KEYS.map((traitKey) => traits[traitKey]);

  const eliteTraitCount = countEliteTraits(traits);
  const poorTraitCount = countPoorTraits(traits);
  const extremeFaultCount = countExtremeFaultTraits(traits);
  const spread = traitSpread(traits);

  const nearIdealVisibleCategoryCount = countValuesNearIdeal(categoryValues, 0.75);

  const severeVisibleFaultCategoryCount = categoryValues.filter(
    (value) => scoreValueAgainstIdeal(value) <= 9
  ).length;

  if (allValuesExactlyIdeal(traitValues)) {
    return false;
  }

  // Reject flat dogs
  if (spread < 2.5) {
    return false;
  }

  // Reject suspiciously clean dogs
  if (eliteTraitCount > 4) {
    return false;
  }

  // Reject accidental superdogs
  if (nearIdealVisibleCategoryCount > 3) {
    return false;
  }

  // Reject hopeless dogs
  if (extremeFaultCount > 2) {
    return false;
  }

  if (poorTraitCount > 5) {
    return false;
  }

  if (severeVisibleFaultCategoryCount >= 4) {
    return false;
  }

  // Require at least something appealing
  if (averageIdealScore(categoryValues) < 10) {
    return false;
  }

  return true;
}

function generateFoundationTraits(
  baseline: DogTraits,
  band: FoundationQualityBand,
  random01: () => number
): DogTraits {
  const targetMeans = buildTargetMeans(baseline, band, random01);
  let bestCandidate: DogTraits | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateCandidateTraits(targetMeans, random01);

    if (isFoundationCandidateAcceptable(candidate)) {
      return candidate;
    }

    const visible = deriveVisibleCategoriesFromTraits(candidate);
    const categoryValues = geneticVisibleCategoryValues(visible);
    const visibleQuality = averageIdealScore(categoryValues);
    const visibleFaultPressure = averageIdealDistance(categoryValues);
    const spread = traitSpread(candidate);

    const score =
      visibleQuality -
      visibleFaultPressure +
      Math.min(spread, 6) * 0.4 -
      countExtremeFaultTraits(candidate) * 3 -
      countPoorTraits(candidate) * 1.5 -
      Math.max(0, countEliteTraits(candidate) - 4) * 3 -
      Math.max(0, countValuesNearIdeal(categoryValues, 0.75) - 3) * 2;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate ?? generateCandidateTraits(targetMeans, random01);
}

function calculateSuggestedPrice(
  visibleCategories: VisibleCategories,
  band: FoundationQualityBand
): number {
  const visibleQuality = averageIdealScore(
    geneticVisibleCategoryValues(visibleCategories)
  );

  let bandAdjustment = 0;
  switch (band) {
    case "NICE_FOUNDATION":
      bandAdjustment = 250;
      break;
    case "ROUGH_FOUNDATION":
      bandAdjustment = -250;
      break;
    case "STANDARD_FOUNDATION":
    default:
      bandAdjustment = 0;
      break;
  }

  const scoreAdjustment = Math.round((visibleQuality - 14) * PRICE_STEP);
  return Math.max(1000, PRICE_BASE + bandAdjustment + scoreAdjustment);
}

export function createFoundationDogProfile(
  input: CreateFoundationDogEngineInput
): FoundationDogEngineResult {
  const random01 = input.random01 ?? Math.random;
  const sex = input.sex ?? pickSex(random01);
  const qualityBand = pickQualityBand(random01);
  // GEN-09C ordinary imports are external, genotype-first stock. GEN-06E's
  // spread 14 remains reserved for clean-reset founder calibration.
  const sampleOrdinaryAllele = () => {
    const centered = Array.from({ length: 6 }, () => random01() * 2 - 1).reduce((sum, value) => sum + value, 0) / 6;
    return Math.round(centered * ORDINARY_IMPORT_CALIBRATION.ALLELE_SPREAD * 1_000_000) / 1_000_000;
  };
  const mode = input.populationContext?.geneticDiversityContext.source.mode;
  const isPopulationContext = mode === "LIVE" || mode === "RETAINED_BASELINE";
  const lociEvidence = contextLoci(input.populationContext);
  const candidates = opportunityCandidates(input.populationContext, lociEvidence);
  const desiredTargetCount: 0 | 1 | 2 = !isPopulationContext || candidates.length === 0 ? 0 : (() => {
    const targetRoll = random01();
    return targetRoll < FOUNDATION_OPPORTUNITY_TARGETS.TWO ? 2 : targetRoll < FOUNDATION_OPPORTUNITY_TARGETS.TWO + FOUNDATION_OPPORTUNITY_TARGETS.ONE ? 1 : 0;
  })();
  const sampleBaseAllele = sampleOrdinaryAllele;
  const remainingCandidates = [...candidates];
  const targetedOpportunityIdentities: FoundationOpportunityIdentity[] = [];
  while (targetedOpportunityIdentities.length < desiredTargetCount && remainingCandidates.length > 0) {
    const selected = chooseWeighted(
      remainingCandidates,
      remainingCandidates.map(candidate => candidate.reasons.includes("EFFECTIVELY_FIXED_LOCUS_DIVERSITY") ? 2 : 1),
      random01
    );
    targetedOpportunityIdentities.push({ trait: selected.trait, locus: selected.locus, reasons: selected.reasons });
    remainingCandidates.splice(remainingCandidates.findIndex(candidate => candidate.locus === selected.locus), 1);
  }
  const targetsByLocus = new Map(targetedOpportunityIdentities.map(identity => [identity.locus, identity]));
  const evidenceByLocus = new Map(lociEvidence.map(evidence => [evidence.locus, evidence]));
  const sampleComponentAllele = (component: { component: string }) => {
    const allele = Number(component.component) + (random01() - 0.5) * 0.5;
    return Math.round(Math.max(-20, Math.min(20, allele)) * 1_000_000) / 1_000_000;
  };
  const populationAlleles = (locus: number): readonly [number, number] => {
    const evidence = evidenceByLocus.get(locus);
    if (!isPopulationContext || !evidence) return [sampleBaseAllele(), sampleBaseAllele()];
    const target = targetsByLocus.get(locus);
    const conspicuousLowFrequency = target?.reasons.includes("LOW_FREQUENCY_COMPONENT")
      ? evidence.components.filter(component => component.share <= FOUNDATION_OPPORTUNITY_TARGETS.CONSPICUOUS_COMPONENT_MAX_SHARE)
      : [];
    const targetedDiploidMix = target?.reasons.length === 1
      ? FOUNDATION_OPPORTUNITY_TARGETS.TARGETED_LOW_FREQUENCY_DIPLOID_MIX
      : FOUNDATION_OPPORTUNITY_TARGETS.TARGETED_COMPOSITE_SCARCITY_DIPLOID_MIX;
    if (conspicuousLowFrequency.length > 0 && random01() < targetedDiploidMix) {
      const component = chooseWeighted(conspicuousLowFrequency, conspicuousLowFrequency.map(value => Math.max(.001, 1 - value.share)), random01);
      return [sampleComponentAllele(component), sampleComponentAllele(component)];
    }
    const populationAllele = () => {
      if (random01() >= FOUNDATION_OPPORTUNITY_TARGETS.POPULATION_COMPONENT_MIX) return sampleBaseAllele();
    const ordinary = chooseWeighted(evidence.components, evidence.components.map(component => component.share), random01);
    let chosen = ordinary;
    if (target && random01() < FOUNDATION_OPPORTUNITY_TARGETS.TARGET_ALTERNATIVE_BIAS) {
      const direction = directionalScarcity(input.populationContext, target.trait);
      const preferred = evidence.components.filter(component =>
        (target.reasons.includes("OPPOSITE_DIRECTION_SCARCITY") && Math.sign(Number(component.component)) === direction) ||
        (target.reasons.includes("LOW_FREQUENCY_COMPONENT") && component.share <= FOUNDATION_OPPORTUNITY_TARGETS.LOW_FREQUENCY_COMPONENT_MAX_SHARE) ||
        ((target.reasons.includes("NEAR_FIXED_LOCUS_DIVERSITY") || target.reasons.includes("EFFECTIVELY_FIXED_LOCUS_DIVERSITY")) && component.share < Math.max(...evidence.components.map(value => value.share)))
      );
      const alternatives = preferred.length > 0 ? preferred : evidence.components;
      chosen = chooseWeighted(alternatives, alternatives.map(component => Math.max(0.001, 1 - component.share)), random01);
    }
      return sampleComponentAllele(chosen);
    };
    return [populationAllele(), populationAllele()];
  };
  const ordinaryCandidate = (): CanonicalGenotype => ({ geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => populationAlleles(locus)) });
  let genotype = ordinaryCandidate();
  let traits = calculatePhenotypeFromGenotype(genotype);
  const needsOrdinaryPlausibilityRetry = true;
  for (let attempt = 1; needsOrdinaryPlausibilityRetry && attempt < ORDINARY_IMPORT_CALIBRATION.MAX_CANDIDATE_ATTEMPTS && !isOrdinaryFoundationPhenotypePlausible({ traits, populationContext: input.populationContext }); attempt += 1) {
    genotype = ordinaryCandidate();
    traits = calculatePhenotypeFromGenotype(genotype);
  }
  if (needsOrdinaryPlausibilityRetry && !isOrdinaryFoundationPhenotypePlausible({ traits, populationContext: input.populationContext })) {
    genotype = {
      geneticsVersion: CURRENT_GENETICS_VERSION,
      loci: Array.from({ length: TOTAL_LOCI }, () => [
        Math.round((random01() * 2 - 1) * ORDINARY_IMPORT_CALIBRATION.EMERGENCY_ALLELE_BOUND * 1_000_000) / 1_000_000,
        Math.round((random01() * 2 - 1) * ORDINARY_IMPORT_CALIBRATION.EMERGENCY_ALLELE_BOUND * 1_000_000) / 1_000_000,
      ] as const),
    };
    traits = calculatePhenotypeFromGenotype(genotype);
  }
  const observedOpportunityIdentities = classifyFoundationOpportunities({ populationContext: input.populationContext, genotype });
  const visibleCategories = deriveVisibleCategoriesFromTraits(traits);
  const suggestedPrice = calculateSuggestedPrice(visibleCategories, qualityBand);

  const dog: Dog = {
    dogId: input.dogId,
    regNumber: input.regNumber,
    breedCode2: input.breedCode2,
    birthEpoch: input.birthEpoch,
    sex,
    status: "ALIVE",
    litterId: null,
    litterOrder: null,
    sireId: null,
    damId: null,
    traits,
    genotype: encodeGenotype(genotype),
    geneticsVersion: CURRENT_GENETICS_VERSION,
  };

  return {
    dog,
    callName: input.callName,
    qualityBand,
    visibleCategories,
    suggestedPrice,
    geneticsAnalysis: {
      eligibleScarcityIdentities: candidates.map(candidate => ({ trait: candidate.trait, locus: candidate.locus, reasons: candidate.reasons })),
      opportunityTargetCount: targetedOpportunityIdentities.length as 0 | 1 | 2,
      targetedOpportunityIdentities,
      observedOpportunityIdentities,
      observedOpportunityCount: observedOpportunityIdentities.length,
    },
  };
}

