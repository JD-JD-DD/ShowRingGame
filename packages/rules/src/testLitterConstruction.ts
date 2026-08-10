import assert from "node:assert/strict";

import { createLitter, resolveWhelp, type BreedingAttempt, type DogTraits } from "./index";

const traits: DogTraits = {
  head: 10,
  forequarters: 10,
  hindquarters: 10,
  gait: 10,
  coat: 10,
  size: 10,
  temperament: 10,
  show_shine: 10,
  feet: 10,
  topline: 10,
};

const attempt: BreedingAttempt = {
  attemptId: "attempt-1",
  sireId: "sire-1",
  damId: "dam-1",
  breedCode2: "BC",
  createdEpoch: 10,
  pregCheckEpoch: 20,
  dueEpoch: 30,
  checkedEpoch: 20,
  isPregnant: true,
  whelpedEpoch: null,
  litterId: null,
  rngSeed: 123,
  status: "PREGNANT",
};

const litterInput = {
  litterId: "litter-1",
  breedCode2: "BC",
  bornEpoch: 30,
  sireId: "sire-1",
  damId: "dam-1",
  pupCount: 1,
  puppyDogIds: ["pup-1"],
  puppySexes: ["F" as const],
  sireTraits: traits,
  damTraits: traits,
  coiPercent: 0,
  coiGenerationDepth: 1,
  random01: () => 0.5,
};

assert.throws(() => createLitter(litterInput), /pupCount must be between 2 and 14/);
const survivorLitter = createLitter({ ...litterInput, allowSinglePuppy: true });
assert.equal(survivorLitter.litter.pupCount, 1);
assert.equal(survivorLitter.puppies.length, 1);
assert.equal(survivorLitter.puppies[0]?.litterId, "litter-1");

const whelpInput = {
  attempt,
  currentEpoch: 30,
  litterId: "litter-2",
  pupCount: 1,
  puppyDogIds: ["pup-2"],
  puppySexes: ["M" as const],
  sireTraits: traits,
  damTraits: traits,
  coiPercent: 0,
  coiGenerationDepth: 1,
  random01: () => 0.5,
};

assert.throws(() => resolveWhelp(whelpInput), /pupCount must be between 2 and 14/);
const survivorWhelp = resolveWhelp({ ...whelpInput, allowSinglePuppy: true });
assert.equal(survivorWhelp.litter.pupCount, 1);
assert.equal(survivorWhelp.puppies.length, 1);
assert.equal(survivorWhelp.attempt.status, "WHELPED");
assert.equal(survivorWhelp.attempt.litterId, "litter-2");

console.log("Single-puppy survivor litter construction checks passed.");
