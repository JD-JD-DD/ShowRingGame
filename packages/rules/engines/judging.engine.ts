// how dogs are scored

import type { Dog, DogTraits } from "./dog.engine";
import type { Judge } from "./judge.engine";
import {
  JUDGING_CATEGORIES,
  CATEGORY_TRAIT_MAP,
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
};

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function deriveShowCharacteristicsFromTraits(
  traits: DogTraits
): ShowCharacteristics {
  const result = {} as ShowCharacteristics;

  for (const category of JUDGING_CATEGORIES) {
    const traitKeys = CATEGORY_TRAIT_MAP[category];
    const values = traitKeys.map((trait) => traits[trait]);
    result[category] = average(values);
  }

  return result;
}

export function scoreDogByJudgeWeights(args: {
  dog: Dog;
  judge: Judge;
}): JudgedDogBreakdown {
  const { dog, judge } = args;

  const characteristics = deriveShowCharacteristicsFromTraits(dog.traits);
  const weightedCategoryScores = {} as WeightedCategoryScores;

  let baseScore = 0;

  for (const category of JUDGING_CATEGORIES) {
    const idealScore = scoreValueAgainstIdeal(characteristics[category]);
    const categoryScore =
      idealScore * judge.categoryWeights[category];

    weightedCategoryScores[category] = categoryScore;
    baseScore += categoryScore;
  }

  return {
    dogId: dog.dogId,
    regNumber: dog.regNumber,
    characteristics,
    weightedCategoryScores,
    baseScore,
  };
}

export function rankDogsByJudgeWeights(args: {
  dogs: Dog[];
  judge: Judge;
}): JudgedDogBreakdown[] {
  const { dogs, judge } = args;

  return dogs
    .map((dog) => scoreDogByJudgeWeights({ dog, judge }))
    .sort((a, b) => b.baseScore - a.baseScore);
}
