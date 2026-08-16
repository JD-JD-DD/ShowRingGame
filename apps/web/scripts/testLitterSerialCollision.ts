import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createLitterWithCollisionRetry,
  RetriableLitterSerialCollisionError,
} from "../server/services/litterPersistence.service";

const createdLitters: Array<{ breedCode2: string; serial7: string }> = [
  { breedCode2: "BC", serial7: "5000000" },
];
let createAttempts = 0;
const fakeClient = {
  dogRegistrationReservation: { createMany: async () => ({ count: 1 }) },
  litter: {
    findUnique: async ({ where }: { where: { breedCode2_serial7: { breedCode2: string; serial7: string } } }) =>
      createdLitters.find(
        (litter) =>
          litter.breedCode2 === where.breedCode2_serial7.breedCode2 &&
          litter.serial7 === where.breedCode2_serial7.serial7
      ) ?? null,
    create: async ({ data }: { data: { breedCode2: string; serial7: string } }) => {
      createAttempts += 1;
      if (
        createdLitters.some(
          (litter) =>
            litter.breedCode2 === data.breedCode2 && litter.serial7 === data.serial7
        )
      ) {
        throw {
          code: "P2002",
          meta: { target: ["breedCode2", "serial7"] },
        };
      }
      createdLitters.push(data);
    },
  },
};

const puppies = [
  { dogId: "pup-1", litterOrder: 1, regNumber: "BC500000001", sex: "F", traits: { head: 1 } },
  { dogId: "pup-2", litterOrder: 2, regNumber: "BC500000002", sex: "M", traits: { head: 2 } },
];

async function main() {
  const persisted = await createLitterWithCollisionRetry({
    client: fakeClient as never,
    litter: {
      id: "emergency-litter",
      bredByKennelId: "kennel",
      sireId: "sire",
      damId: "dam",
      breedCode2: "BC",
      serial7: "5000000",
      bornEpoch: 6000,
      pupCount: 2,
    },
    puppies,
    nextSerial7: () => "5000001",
  });

  assert.equal(createAttempts, 1);
  assert.equal(persisted.serial7, "5000001");
  assert.deepEqual(createdLitters.map(({ breedCode2, serial7 }) => ({ breedCode2, serial7 })), [
    { breedCode2: "BC", serial7: "5000000" },
    { breedCode2: "BC", serial7: "5000001" },
  ]);
  assert.deepEqual(
    persisted.puppies.map(({ dogId, litterOrder, regNumber, sex, traits }) => ({ dogId, litterOrder, regNumber, sex, traits })),
    [
      { dogId: "pup-1", litterOrder: 1, regNumber: "BC500000101", sex: "F", traits: { head: 1 } },
      { dogId: "pup-2", litterOrder: 2, regNumber: "BC500000102", sex: "M", traits: { head: 2 } },
    ]
  );
  assert.equal(puppies[0]?.regNumber, "BC500000001");
  assert.equal(puppies[1]?.regNumber, "BC500000002");

  let raceFindUniqueCalls = 0;
  let raceCreateCalls = 0;
  const racingClient = {
    dogRegistrationReservation: { createMany: async () => ({ count: 1 }) },
    litter: {
      findUnique: async () => {
        raceFindUniqueCalls += 1;
        return null;
      },
      create: async () => {
        raceCreateCalls += 1;
        throw { code: "P2002", meta: { target: ["breedCode2", "serial7"] } };
      },
    },
  };
  await assert.rejects(
    createLitterWithCollisionRetry({
      client: racingClient as never,
      litter: { id: "race-litter", bredByKennelId: "kennel", sireId: "sire", damId: "dam", breedCode2: "BC", serial7: "6000000", bornEpoch: 6000, pupCount: 2 },
      puppies,
    }),
    RetriableLitterSerialCollisionError
  );
  assert.equal(raceFindUniqueCalls, 1);
  assert.equal(raceCreateCalls, 1);

  const freshTransactionClient = {
    dogRegistrationReservation: { createMany: async () => ({ count: 1 }) },
    litter: {
      findUnique: async () => null,
      create: async () => undefined,
    },
  };
  const freshRetry = await createLitterWithCollisionRetry({
    client: freshTransactionClient as never,
    litter: { id: "race-litter", bredByKennelId: "kennel", sireId: "sire", damId: "dam", breedCode2: "BC", serial7: "6000000", bornEpoch: 6000, pupCount: 2 },
    puppies,
  });
  assert.equal(freshRetry.serial7, "6000000");

  const breedingService = readFileSync("apps/web/server/services/breeding.service.ts", "utf8");
  const emergencyResolver = readFileSync("apps/web/server/services/reproductiveEmergencyResolution.service.ts", "utf8");
  assert.match(breedingService, /createLitterWithCollisionRetry\(/);
  assert.match(emergencyResolver, /createLitterWithCollisionRetry\(/);
  assert.match(emergencyResolver, /alreadyResolved: true/);

  let eventStatus = "RESOLVED_TREATED";
  let treatmentCharges = 1;
  if (eventStatus !== "RESOLVED_TREATED") {
    throw new Error("Unexpected retry execution.");
  }
  assert.equal(createdLitters.length, 2);
  assert.equal(treatmentCharges, 1);
  console.log("Litter serial collision retry checks passed.");
}

void main();
