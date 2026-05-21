// how dogs are scored

import type { Dog, DogTraits } from "./dog.engine";
import type { Judge } from "./judge.engine";
import {
  JUDGING_CATEGORIES,
  CATEGORY_TRAIT_MAP,
  DOG_DAY_VARIANCE,
  RING_RANDOMNESS,
  type JudgingCategory,
} from "../constants/judging.constants";
import { scoreValueAgainstIdeal } from "./idealScoring.engine";

export type ShowCharacteristics = Record<JudgingCategory, number>;
export type WeightedCategoryScores = Record<JudgingCategory, number>;

export type JudgedDogBreakdown = {
  dogId: string;
  regNumber: string;
  characteristics: ShowCharacteristics;
  weightedCategoryScores: WeightedCategoryScores;
  baseScore: number;
  dogDayAdjustment: number;
  ringRandomnessAdjustment: number;
  finalScore: number;
  tieBreakRoll: number;
};

export type JudgingEntry = {
  showEntryId?: string;
  dog: Dog;
};

export type JudgedEntryResult = JudgedDogBreakdown & {
  showEntryId?: string;
  finalRank: number;
  placementCode: string;
};

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

function centeredPercentAdjustment(
  baseScore: number,
  percent: number,
  random01: () => number
): number {
  const multiplier = (random01() * 2 - 1) * percent;
  return roundScore(baseScore * multiplier);
}

export function deriveShowCharacteristicsFromTraits(
  traits: DogTraits
): ShowCharacteristics {
  const result = {} as ShowCharacteristics;

  for (const category of JUDGING_CATEGORIES) {
    const traitKeys = CATEGORY_TRAIT_MAP[category];
    const values = traitKeys.map((trait) => traits[trait]);
    result[category] = roundScore(average(values));
  }

  return result;
}

export function scoreDogByJudgeWeights(args: {
  dog: Dog;
  judge: Judge;
  random01?: () => number;
}): JudgedDogBreakdown {
  const { dog, judge } = args;
  const random01 = args.random01 ?? Math.random;

  const characteristics = deriveShowCharacteristicsFromTraits(dog.traits);
  const weightedCategoryScores = {} as WeightedCategoryScores;

  let baseScore = 0;

  for (const category of JUDGING_CATEGORIES) {
    const idealScore = scoreValueAgainstIdeal(characteristics[category]);
    const categoryScore =
      idealScore * judge.categoryWeights[category];

    weightedCategoryScores[category] = roundScore(categoryScore);
    baseScore += categoryScore;
  }

  const roundedBaseScore = roundScore(baseScore);
  const dogDayAdjustment = centeredPercentAdjustment(
    roundedBaseScore,
    DOG_DAY_VARIANCE,
    random01
  );
  const ringRandomnessAdjustment = centeredPercentAdjustment(
    roundedBaseScore,
    RING_RANDOMNESS,
    random01
  );
  const finalScore = roundScore(
    roundedBaseScore + dogDayAdjustment + ringRandomnessAdjustment
  );

  return {
    dogId: dog.dogId,
    regNumber: dog.regNumber,
    characteristics,
    weightedCategoryScores,
    baseScore: roundedBaseScore,
    dogDayAdjustment,
    ringRandomnessAdjustment,
    finalScore,
    tieBreakRoll: random01(),
  };
}

function compareJudgedDogs(
  a: JudgedDogBreakdown,
  b: JudgedDogBreakdown
): number {
  if (b.finalScore !== a.finalScore) {
    return b.finalScore - a.finalScore;
  }

  if (
    b.weightedCategoryScores.STRUCTURE_BALANCE !==
    a.weightedCategoryScores.STRUCTURE_BALANCE
  ) {
    return (
      b.weightedCategoryScores.STRUCTURE_BALANCE -
      a.weightedCategoryScores.STRUCTURE_BALANCE
    );
  }

  if (b.weightedCategoryScores.MOVEMENT !== a.weightedCategoryScores.MOVEMENT) {
    return b.weightedCategoryScores.MOVEMENT - a.weightedCategoryScores.MOVEMENT;
  }

  return b.tieBreakRoll - a.tieBreakRoll;
}

export function judgeBreedEntries(args: {
  entries: JudgingEntry[];
  judge: Judge;
  random01?: () => number;
}): JudgedEntryResult[] {
  const random01 = args.random01 ?? Math.random;

  return args.entries
    .map((entry) => ({
      showEntryId: entry.showEntryId,
      ...scoreDogByJudgeWeights({
        dog: entry.dog,
        judge: args.judge,
        random01,
      }),
    }))
    .sort(compareJudgedDogs)
    .map((result, index) => ({
      ...result,
      finalRank: index + 1,
      placementCode: String(index + 1),
    }));
}

export function rankDogsByJudgeWeights(args: {
  dogs: Dog[];
  judge: Judge;
  random01?: () => number;
}): JudgedDogBreakdown[] {
  return judgeBreedEntries({
    entries: args.dogs.map((dog) => ({ dog })),
    judge: args.judge,
    random01: args.random01,
  }).map(({ showEntryId, finalRank, placementCode, ...result }) => result);
}
