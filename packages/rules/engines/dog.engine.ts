import {
  TRAIT_MAX,
  TRAIT_MIN,
} from "../constants/genetics.constants";
import { getLifecycleFlags, type DogStatus, type Sex } from "../src/lifecycle";
import { generatePuppyTraits } from "./trait.engine";

import type { TraitKey } from "../constants/genetics.constants"

export type DogTraits = Record<TraitKey, number>

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
  traits: DogTraits;
};

export type CreateFoundationDogInput = {
  dogId: string;
  regNumber: string;
  breedCode2: string;
  birthEpoch: number;
  sex: Sex;
  status?: DogStatus;
  random01?: () => number;
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
  sireTraits: DogTraits
  damTraits: DogTraits
  random01?: () => number;
};

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
}

function rollTrait(random01: () => number): number {
  return clampTrait(Math.floor(random01() * (TRAIT_MAX + 1)));
}

/**
 * Temporary trait generator.
 * Later this is where parent-based inheritance should happen.
 */
function generateRandomTraits(random01: () => number): DogTraits {
  return {
    head: rollTrait(random01),
    forequarters: rollTrait(random01),
    hindquarters: rollTrait(random01),
    gait: rollTrait(random01),
    coat: rollTrait(random01),
    size: rollTrait(random01),
    temperament: rollTrait(random01),
    show_shine: rollTrait(random01),
    feet: rollTrait(random01),
    topline: rollTrait(random01),
  };
}

export function createFoundationDog(
  input: CreateFoundationDogInput
): Dog {
  const random01 = input.random01 ?? Math.random;

  return {
    dogId: input.dogId,
    regNumber: input.regNumber,
    breedCode2: input.breedCode2,
    birthEpoch: input.birthEpoch,
    sex: input.sex,
    status: input.status ?? "ALIVE",
    litterId: null,
    litterOrder: null,
    sireId: null,
    damId: null,
    traits: generateRandomTraits(random01),
  };
}

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
    traits: generatePuppyTraits({
      sireTraits: input.sireTraits,
      damTraits: input.damTraits,
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