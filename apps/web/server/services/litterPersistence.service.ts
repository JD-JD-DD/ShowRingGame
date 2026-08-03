import { randomInt } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { buildRegNumber } from "@showring/rules";

const MAX_LITTER_SERIAL_ATTEMPTS = 5;

type LitterRow = {
  id: string;
  bredByKennelId: string | null;
  sireId: string;
  damId: string;
  breedCode2: string;
  serial7: string;
  bornEpoch: number;
  pupCount: number;
};

type PuppyWithRegistration = {
  litterOrder: number | null;
  regNumber: string;
};

function isLitterSerialCollision(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "P2002" ||
    !("meta" in error) ||
    typeof error.meta !== "object" ||
    error.meta === null ||
    !("target" in error.meta) ||
    !Array.isArray(error.meta.target)
  ) {
    return false;
  }

  return (
    error.meta.target.includes("breedCode2") &&
    error.meta.target.includes("serial7")
  );
}

function generateReplacementSerial7(): string {
  return String(randomInt(10_000_000)).padStart(7, "0");
}

function rebuildPuppyRegistrations<Puppy extends PuppyWithRegistration>(args: {
  puppies: Puppy[];
  breedCode2: string;
  serial7: string;
}): Puppy[] {
  return args.puppies.map((puppy) => {
    if (puppy.litterOrder === null) {
      throw new Error("Litter puppy is missing its litter order.");
    }
    return {
      ...puppy,
      regNumber: buildRegNumber(args.breedCode2, args.serial7, puppy.litterOrder),
    };
  });
}

export async function createLitterWithCollisionRetry<
  Puppy extends PuppyWithRegistration,
>(args: {
  client: Prisma.TransactionClient;
  litter: LitterRow;
  puppies: Puppy[];
  nextSerial7?: () => string;
}): Promise<{ serial7: string; puppies: Puppy[] }> {
  let serial7 = args.litter.serial7;

  for (let attempt = 1; attempt <= MAX_LITTER_SERIAL_ATTEMPTS; attempt += 1) {
    const puppies = rebuildPuppyRegistrations({
      puppies: args.puppies,
      breedCode2: args.litter.breedCode2,
      serial7,
    });
    try {
      await args.client.litter.create({
        data: {
          ...args.litter,
          serial7,
        },
      });
      return {
        serial7,
        puppies,
      };
    } catch (error) {
      if (!isLitterSerialCollision(error)) throw error;
      if (attempt === MAX_LITTER_SERIAL_ATTEMPTS) {
        throw new Error(
          `Unable to allocate a unique litter serial after ${MAX_LITTER_SERIAL_ATTEMPTS} attempts.`
        );
      }
      serial7 = (args.nextSerial7 ?? generateReplacementSerial7)();
    }
  }

  throw new Error("Unable to allocate a unique litter serial.");
}
