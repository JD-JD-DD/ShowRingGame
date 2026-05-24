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

export type ShowAwardCode =
  | "1"
  | "2"
  | "3"
  | "4"
  | "WD"
  | "RWD"
  | "WB"
  | "RWB"
  | "BOW"
  | "BOB"
  | "BOS"
  | "AOM";

export type ShowAwardGroup =
  | "DOG_CLASS"
  | "BITCH_CLASS"
  | "WINNERS"
  | "BREED";

export type JudgedShowAward = {
  showEntryId?: string;
  dogId: string;
  awardCode: ShowAwardCode;
  awardGroup: ShowAwardGroup;
  sex: "M" | "F" | null;
  rank: number | null;
  pointsAwarded: number;
  isMajor: boolean;
  dogsInCompetition: number | null;
};

export type JudgedBreedBlock = {
  results: JudgedEntryResult[];
  awards: JudgedShowAward[];
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

function getTemporaryAllBreedPoints(dogsInCompetition: number): number {
  if (dogsInCompetition >= 7) return 5;
  if (dogsInCompetition >= 6) return 4;
  if (dogsInCompetition >= 5) return 3;
  if (dogsInCompetition >= 4) return 2;
  if (dogsInCompetition >= 3) return 1;
  return 0;
}

function makeAward(args: {
  result: JudgedEntryResult;
  awardCode: ShowAwardCode;
  awardGroup: ShowAwardGroup;
  sex: "M" | "F" | null;
  rank: number | null;
  pointsAwarded?: number;
  dogsInCompetition?: number | null;
}): JudgedShowAward {
  const pointsAwarded = args.pointsAwarded ?? 0;

  return {
    showEntryId: args.result.showEntryId,
    dogId: args.result.dogId,
    awardCode: args.awardCode,
    awardGroup: args.awardGroup,
    sex: args.sex,
    rank: args.rank,
    pointsAwarded,
    isMajor: pointsAwarded >= 3,
    dogsInCompetition: args.dogsInCompetition ?? null,
  };
}

function buildSexClassAwards(args: {
  results: JudgedEntryResult[];
  sex: "M" | "F";
}): JudgedShowAward[] {
  const { results, sex } = args;
  const awardGroup: ShowAwardGroup =
    sex === "M" ? "DOG_CLASS" : "BITCH_CLASS";
  const awards: JudgedShowAward[] = [];

  for (const [index, result] of results.slice(0, 4).entries()) {
    const rank = index + 1;

    awards.push(
      makeAward({
        result,
        awardCode: String(rank) as ShowAwardCode,
        awardGroup,
        sex,
        rank,
        dogsInCompetition: results.length,
      })
    );
  }

  return awards;
}

function buildWinnersAwards(args: {
  results: JudgedEntryResult[];
  sex: "M" | "F";
}): JudgedShowAward[] {
  const { results, sex } = args;
  const winner = results[0];
  const reserve = results[1];
  const awards: JudgedShowAward[] = [];

  if (winner) {
    awards.push(
      makeAward({
        result: winner,
        awardCode: sex === "M" ? "WD" : "WB",
        awardGroup: "WINNERS",
        sex,
        rank: 1,
        pointsAwarded: getTemporaryAllBreedPoints(results.length),
        dogsInCompetition: results.length,
      })
    );
  }

  if (reserve) {
    awards.push(
      makeAward({
        result: reserve,
        awardCode: sex === "M" ? "RWD" : "RWB",
        awardGroup: "WINNERS",
        sex,
        rank: 2,
        dogsInCompetition: results.length,
      })
    );
  }

  return awards;
}

function buildBreedAwards(args: {
  maleResults: JudgedEntryResult[];
  femaleResults: JudgedEntryResult[];
}): JudgedShowAward[] {
  const breedCandidates = [args.maleResults[0], args.femaleResults[0]]
    .filter((result): result is JudgedEntryResult => Boolean(result))
    .sort(compareJudgedDogs);
  const bestOfBreed = breedCandidates[0];
  const bestOfOpposite = breedCandidates.find(
    (result) => result.dogId !== bestOfBreed?.dogId
  );
  const awards: JudgedShowAward[] = [];
  const maleWinnerPoints = getTemporaryAllBreedPoints(args.maleResults.length);
  const femaleWinnerPoints = getTemporaryAllBreedPoints(args.femaleResults.length);
  const bestOfWinnersPoints = Math.max(maleWinnerPoints, femaleWinnerPoints);

  if (bestOfBreed && args.maleResults[0] && args.femaleResults[0]) {
    awards.push(
      makeAward({
        result: bestOfBreed,
        awardCode: "BOW",
        awardGroup: "BREED",
        sex: bestOfBreed.dogId === args.maleResults[0].dogId ? "M" : "F",
        rank: 1,
        pointsAwarded: bestOfWinnersPoints,
        dogsInCompetition: Math.max(
          args.maleResults.length,
          args.femaleResults.length
        ),
      })
    );
  }

  if (bestOfBreed) {
    awards.push(
      makeAward({
        result: bestOfBreed,
        awardCode: "BOB",
        awardGroup: "BREED",
        sex: null,
        rank: 1,
      })
    );
  }

  if (bestOfOpposite) {
    awards.push(
      makeAward({
        result: bestOfOpposite,
        awardCode: "BOS",
        awardGroup: "BREED",
        sex: bestOfOpposite.dogId === args.maleResults[0]?.dogId ? "M" : "F",
        rank: 2,
      })
    );
  }

  return awards;
}

export function judgeBreedBlock(args: {
  entries: JudgingEntry[];
  judge: Judge;
  random01?: () => number;
}): JudgedBreedBlock {
  const results = judgeBreedEntries(args);
  const maleResults = results.filter((result) => {
    const entry = args.entries.find((candidate) => candidate.showEntryId === result.showEntryId);
    return entry?.dog.sex === "M";
  });
  const femaleResults = results.filter((result) => {
    const entry = args.entries.find((candidate) => candidate.showEntryId === result.showEntryId);
    return entry?.dog.sex === "F";
  });

  return {
    results,
    awards: [
      ...buildSexClassAwards({ results: maleResults, sex: "M" }),
      ...buildSexClassAwards({ results: femaleResults, sex: "F" }),
      ...buildWinnersAwards({ results: maleResults, sex: "M" }),
      ...buildWinnersAwards({ results: femaleResults, sex: "F" }),
      ...buildBreedAwards({ maleResults, femaleResults }),
    ],
  };
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
