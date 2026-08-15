import { getLifecycleFlags, type DogStatus, type Sex } from "../src/lifecycle";
import { CURRENT_GENETICS_VERSION } from "../constants/genetics.constants";
import { FINAL_GENETICS_CALIBRATION } from "../calibration/geneticsCalibration.constants";
import { decodeGenotype } from "./genotype.engine";
import { inheritModelDGenotype } from "./polygenicInheritance.engine";

import type { TraitKey } from "../constants/genetics.constants";
import type { JudgingCategory } from "../constants/judging.constants";

export type DogTraits = Record<TraitKey, number>;

export type DogPresentationInfluences = {
  dueEpoch?: number | null;
  lastWhelpedEpoch?: number | null;
  coatCondition?: number | null;
  muscleTone?: number | null;
  ringObedience?: number | null;
  fatiguePoints?: number | null;
  conditioningSnapshot?: number | null;
  fatigueSnapshot?: number | null;
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
  genotype?: string;
  geneticsVersion?: string;
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
  sireGenotype: string;
  sireGeneticsVersion: string;
  damGenotype: string;
  damGeneticsVersion: string;
  coiPercent: number;
  coiGenerationDepth: number;
  random01: () => number;
};

/** The single production Model D inheritance boundary for a logical puppy birth. */
export function generatePuppyGeneticsForBirth(input: Pick<CreateDogFromLitterInput, "sireId" | "damId" | "sireGenotype" | "sireGeneticsVersion" | "damGenotype" | "damGeneticsVersion" | "random01">) {
  const validateParent = (role: "sire" | "dam", id: string, encoded: string, version: string) => {
    if (version !== CURRENT_GENETICS_VERSION) throw new Error(`GEN-08 integrity failure: ${role} ${id} has unsupported geneticsVersion ${String(version)}.`);
    try { return decodeGenotype(encoded); } catch { throw new Error(`GEN-08 integrity failure: ${role} ${id} has an invalid ${CURRENT_GENETICS_VERSION} genotype.`); }
  };
  const result = inheritModelDGenotype({
    sireGenotype: validateParent("sire", input.sireId, input.sireGenotype, input.sireGeneticsVersion),
    damGenotype: validateParent("dam", input.damId, input.damGenotype, input.damGeneticsVersion),
    random01: input.random01,
    mutation: FINAL_GENETICS_CALIBRATION.mutation,
    breedBackground: { version: "breed-background-v1", coefficient: FINAL_GENETICS_CALIBRATION.breedBackgroundCoefficient, sourceStatus: "BASELINE" },
  });
  return { traits: result.phenotype, genotype: result.encodedGenotype, geneticsVersion: result.geneticsVersion };
}

export function createDogFromLitter(
  input: CreateDogFromLitterInput
): Dog {
  const random01 = input.random01;

  const genetics = generatePuppyGeneticsForBirth(input);
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
    traits: genetics.traits,
    genotype: genetics.genotype,
    geneticsVersion: genetics.geneticsVersion,
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

