import {
  DEFAULT_CATEGORY_WEIGHTS,
  JUDGING_CATEGORIES,
  JUDGE_WEIGHT_VARIATION,
  type JudgingCategory,
} from "../constants/judging.constants";

export type JudgeCategoryWeights = Record<JudgingCategory, number>;

export type JudgeStyle =
  | "BALANCED"
  | "TYPE_FOCUSED"
  | "STRUCTURE_FOCUSED"
  | "MOVEMENT_FOCUSED"
  | "PRESENTATION_FOCUSED"
  | "TEMPERAMENT_FOCUSED";

export type Judge = {
  judgeId: string;
  name: string;
  style: JudgeStyle;
  categoryWeights: JudgeCategoryWeights;
};

export type CreateJudgeInput = {
  judgeId: string;
  name: string;
  style?: JudgeStyle;
  random01?: () => number;
};

function clampWeight(weight: number): number {
  const min = 1 - JUDGE_WEIGHT_VARIATION;
  const max = 1 + JUDGE_WEIGHT_VARIATION;

  return Math.max(min, Math.min(max, weight));
}

function randomBetween(random01: () => number, min: number, max: number): number {
  return min + (max - min) * random01();
}

function centeredWeightOffset(random01: () => number): number {
  return randomBetween(
    random01,
    -JUDGE_WEIGHT_VARIATION,
    JUDGE_WEIGHT_VARIATION
  );
}

function buildBaseWeights(): JudgeCategoryWeights {
  return { ...DEFAULT_CATEGORY_WEIGHTS };
}

function applySmallRandomOffsets(
  weights: JudgeCategoryWeights,
  random01: () => number
): JudgeCategoryWeights {
  const adjusted = {} as JudgeCategoryWeights;

  for (const category of JUDGING_CATEGORIES) {
    adjusted[category] = clampWeight(
      weights[category] + centeredWeightOffset(random01)
    );
  }

  return adjusted;
}

function applyStyleBias(
  weights: JudgeCategoryWeights,
  style: JudgeStyle
): JudgeCategoryWeights {
  const adjusted = { ...weights };

  switch (style) {
    case "BALANCED":
      return adjusted;

    case "TYPE_FOCUSED":
      adjusted.TYPE_EXPRESSION = clampWeight(adjusted.TYPE_EXPRESSION + 0.15);
      adjusted.MOVEMENT = clampWeight(adjusted.MOVEMENT - 0.05);
      return adjusted;

    case "STRUCTURE_FOCUSED":
      adjusted.STRUCTURE_BALANCE = clampWeight(
        adjusted.STRUCTURE_BALANCE + 0.15
      );
      adjusted.COAT_PRESENTATION = clampWeight(
        adjusted.COAT_PRESENTATION - 0.05
      );
      return adjusted;

    case "MOVEMENT_FOCUSED":
      adjusted.MOVEMENT = clampWeight(adjusted.MOVEMENT + 0.15);
      adjusted.TYPE_EXPRESSION = clampWeight(adjusted.TYPE_EXPRESSION - 0.05);
      return adjusted;

    case "PRESENTATION_FOCUSED":
      adjusted.COAT_PRESENTATION = clampWeight(
        adjusted.COAT_PRESENTATION + 0.15
      );
      adjusted.CONDITIONING_HANDLING = clampWeight(
        adjusted.CONDITIONING_HANDLING + 0.10
      );
      adjusted.STRUCTURE_BALANCE = clampWeight(
        adjusted.STRUCTURE_BALANCE - 0.05
      );
      return adjusted;

    case "TEMPERAMENT_FOCUSED":
      adjusted.TEMPERAMENT_RING_BEHAVIOR = clampWeight(
        adjusted.TEMPERAMENT_RING_BEHAVIOR + 0.15
      );
      adjusted.TYPE_EXPRESSION = clampWeight(adjusted.TYPE_EXPRESSION - 0.05);
      return adjusted;

    default:
      return adjusted;
  }
}

function pickRandomJudgeStyle(random01: () => number): JudgeStyle {
  const roll = random01();

  if (roll < 0.25) return "BALANCED";
  if (roll < 0.40) return "TYPE_FOCUSED";
  if (roll < 0.55) return "STRUCTURE_FOCUSED";
  if (roll < 0.70) return "MOVEMENT_FOCUSED";
  if (roll < 0.85) return "PRESENTATION_FOCUSED";
  return "TEMPERAMENT_FOCUSED";
}

export function createJudge(input: CreateJudgeInput): Judge {
  const random01 = input.random01 ?? Math.random;
  const style = input.style ?? pickRandomJudgeStyle(random01);

  const baseWeights = buildBaseWeights();
  const randomizedWeights = applySmallRandomOffsets(baseWeights, random01);
  const categoryWeights = applyStyleBias(randomizedWeights, style);

  return {
    judgeId: input.judgeId,
    name: input.name,
    style,
    categoryWeights,
  };
}