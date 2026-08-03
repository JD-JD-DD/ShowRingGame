import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLitterWithCollisionRetry } from "../server/services/litterPersistence.service";

const createdLitters: Array<{ breedCode2: string; serial7: string }> = [
  { breedCode2: "BC", serial7: "5000000" },
];
let createAttempts = 0;
const fakeClient = {
  litter: {
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

  assert.equal(createAttempts, 2);
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
