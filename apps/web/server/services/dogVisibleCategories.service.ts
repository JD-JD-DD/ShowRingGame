import {
  deriveConditioningHandlingScore,
  deriveHealthAdjustedExpressedTraits,
  deriveVisibleCategoriesFromTraits,
  type DogTraits,
  type VisibleCategories,
} from "@showring/rules";
import {
  toRulesDogTraits,
  type PersistedDogTraitRecord,
} from "@/server/services/phenotypePersistence.service";

export const DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES = [
  "HIP_DYSPLASIA",
  "ELBOW_DYSPLASIA",
  "CAER_EYE",
] as const;

export type DogStoredTraitInput = PersistedDogTraitRecord;

export type DogDisplayHealthTruthInput = {
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

export type DogDisplayHealthResultInput = {
  testTypeCode: string;
  resultCode: string;
};

export type DogConditioningDisplayInput = {
  coatCondition: number;
  muscleTone: number;
  ringObedience: number;
  fatiguePoints: number;
};

export function storedTraitsForDisplay(dog: DogStoredTraitInput): DogTraits {
  return toRulesDogTraits(dog);
}

export function deriveCurrentVisibleCategoriesForDogDisplay(input: {
  storedTraits: DogStoredTraitInput;
  phenotypeHealthTruths?: DogDisplayHealthTruthInput[];
  phenotypeHealthResults?: DogDisplayHealthResultInput[];
  conditioning?: DogConditioningDisplayInput;
}): VisibleCategories {
  const expressedTraits = deriveHealthAdjustedExpressedTraits({
    storedTraits: storedTraitsForDisplay(input.storedTraits),
    phenotypeHealthTruths: input.phenotypeHealthTruths,
    phenotypeHealthResults: input.phenotypeHealthResults,
  });

  return {
    ...deriveVisibleCategoriesFromTraits(expressedTraits),
    ...(input.conditioning
      ? {
          conditioningHandling: deriveConditioningHandlingScore(
            input.conditioning
          ),
        }
      : {}),
  };
}
