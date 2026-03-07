import {
  BREED_CODE2_REGEX,
  LITTER_ORDER_PAD,
  LITTER_SERIAL_LENGTH,
} from "../constants/breed.constants";
import {
  MAX_LITTER_SIZE,
  MIN_LITTER_SIZE,
} from "../constants/litter.constants";
import { DogTraits } from "./dog.engine";
import type { Sex } from "../src/lifecycle";
import { createDogFromLitter, type Dog } from "./dog.engine";

export type Litter = {
  litterId: string;
  breedCode2: string;
  serial7: string;
  bornEpoch: number;
  sireId: string;
  damId: string;
  pupCount: number;
};

export type CreateLitterInput = {
  litterId: string;
  breedCode2: string;
  bornEpoch: number;
  sireId: string;
  damId: string;
  pupCount: number;
  puppyDogIds: string[];
  puppySexes: Sex[];
  sireTraits: DogTraits;
  damTraits: DogTraits;
  random01?: () => number;
};

export type LitterWithDogs = {
  litter: Litter;
  puppies: Dog[];
};

function assertFiniteInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a finite integer.`);
  }
}

function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertRoll(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`${label} must be >= 0 and < 1.`);
  }
}

export function isValidBreedCode2(code: string): boolean {
  return BREED_CODE2_REGEX.test(code);
}

export function isValidSerial7(serial7: string): boolean {
  const pattern = new RegExp(`^\\d{${LITTER_SERIAL_LENGTH}}$`);
  return pattern.test(serial7);
}

export function buildRegNumber(
  breedCode2: string,
  serial7: string,
  litterOrder: number
): string {
  if (!isValidBreedCode2(breedCode2)) {
    throw new Error("breedCode2 must be two uppercase letters.");
  }

  if (!isValidSerial7(serial7)) {
    throw new Error(`serial7 must be exactly ${LITTER_SERIAL_LENGTH} digits.`);
  }

  if (!Number.isInteger(litterOrder) || litterOrder < 1 || litterOrder > 99) {
    throw new Error("litterOrder must be an integer between 1 and 99.");
  }

  return `${breedCode2}${serial7}${String(litterOrder).padStart(
    LITTER_ORDER_PAD,
    "0"
  )}`;
}

export function generateSerial7(random01: () => number): string {
  const roll = random01();
  assertRoll(roll, "random01()");

  const max = 10 ** LITTER_SERIAL_LENGTH;
  const value = Math.floor(roll * max);

  return String(value).padStart(LITTER_SERIAL_LENGTH, "0");
}

export function createLitter(input: CreateLitterInput): LitterWithDogs {
  const random01 = input.random01 ?? Math.random;

  assertFiniteInteger(input.bornEpoch, "bornEpoch");
  assertPositiveInt(input.pupCount, "pupCount");

  if (!isValidBreedCode2(input.breedCode2)) {
    throw new Error("breedCode2 must be two uppercase letters.");
  }

  if (input.pupCount < MIN_LITTER_SIZE || input.pupCount > MAX_LITTER_SIZE) {
    throw new Error(
      `pupCount must be between ${MIN_LITTER_SIZE} and ${MAX_LITTER_SIZE}.`
    );
  }

  if (input.puppyDogIds.length !== input.pupCount) {
    throw new Error("puppyDogIds length must equal pupCount.");
  }

  if (input.puppySexes.length !== input.pupCount) {
    throw new Error("puppySexes length must equal pupCount.");
  }

  const serial7 = generateSerial7(random01);

  const litter: Litter = {
    litterId: input.litterId,
    breedCode2: input.breedCode2,
    serial7,
    bornEpoch: input.bornEpoch,
    sireId: input.sireId,
    damId: input.damId,
    pupCount: input.pupCount,
  };

  const puppies: Dog[] = Array.from({ length: input.pupCount }, (_, index) => {
    const litterOrder = index + 1;
    const regNumber = buildRegNumber(input.breedCode2, serial7, litterOrder);

    return createDogFromLitter({
      dogId: input.puppyDogIds[index],
      regNumber,
      breedCode2: input.breedCode2,
      birthEpoch: input.bornEpoch,
      sex: input.puppySexes[index],
      litterId: input.litterId,
      litterOrder,
      sireId: input.sireId,
      damId: input.damId,
      sireTraits: input.sireTraits,
      damTraits: input.damTraits,
      random01,
    });
  });

  return {
    litter,
    puppies,
  };
}