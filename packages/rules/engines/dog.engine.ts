import { getLifecycleFlags, type DogStatus, type Sex } from "../src/lifecycle";
import { generatePuppyTraits } from "./trait.engine";

import type { TraitKey } from "../constants/genetics.constants";
import type { JudgingCategory } from "../constants/judging.constants";

export type DogTraits = Record<TraitKey, number>;

export type DogPresentationInfluences = {
  dueEpoch?: number | null;
  lastWhelpedEpoch?: number | null;
  phenotypeHealthTruths?: Array<{
    conditionCode: string;
    geneticLiability: number;
    environmentModifier: number;
  }>;
  phenotypeHealthResults?: Array<{
    testTypeCode: string;
    resultCode: string;
  }>;
  conditioningMultiplierByCategory?: Partial<Record<JudgingCategory, number>>;
  groomingMultiplierByCategory?: Partial<Record<JudgingCategory, number>>;
  handlingMultiplierByCategory?: Partial<Record<JudgingCategory, number>>;
};

export type Dog = {
  dogId: string;
  regNumber: string;
  breedCode2: string;
  birthEpoch: number;
  sex: Sex;
  status: DogStatus;
  litterId: string | null;
  litterOrder: number | null;
  sireId: string | null;
  damId: string | null;
  coiPercent?: number;
  coiGenerationDepth?: number;
  presentation?: DogPresentationInfluences;
  traits: DogTraits;
};

export type CreateDogFromLitterInput = {
  dogId: string;
  regNumber: string;
  breedCode2: string;
  birthEpoch: number;
  sex: Sex;
  litterId: string;
  litterOrder: number;
  sireId: string;
  damId: string;
  status?: DogStatus;
  sireTraits: DogTraits;
  damTraits: DogTraits;
  coiPercent: number;
  coiGenerationDepth: number;
  random01?: () => number;
};

export function createDogFromLitter(
  input: CreateDogFromLitterInput
): Dog {
  const random01 = input.random01 ?? Math.random;

  return {
    dogId: input.dogId,
    regNumber: input.regNumber,
    breedCode2: input.breedCode2,
    birthEpoch: input.birthEpoch,
    sex: input.sex,
    status: input.status ?? "ALIVE",
    litterId: input.litterId,
    litterOrder: input.litterOrder,
    sireId: input.sireId,
    damId: input.damId,
    coiPercent: input.coiPercent,
    coiGenerationDepth: input.coiGenerationDepth,
    traits: generatePuppyTraits({
      sireTraits: input.sireTraits,
      damTraits: input.damTraits,
      coiPercent: input.coiPercent,
      random01,
    }),
  };
}

export function getDogSnapshot(currentEpoch: number, dog: Dog) {
  return {
    ...dog,
    lifecycle: getLifecycleFlags({
      currentEpoch,
      birthEpoch: dog.birthEpoch,
      status: dog.status,
      sex: dog.sex,
    }),
  };
}

