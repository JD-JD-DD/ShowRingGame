import assert from "node:assert/strict";

import { generatePuppyGeneticsForBirth, type DogTraits } from "@showring/rules";
import { createPuppyGeneticsRandom01, createPuppyGeneticsRandom01ForLitter } from "../server/services/puppyGenetics.service";

const traits: DogTraits = { head: 8, forequarters: 9, hindquarters: 10, gait: 11, coat: 12, size: 7, temperament: 13, show_shine: 6, feet: 14, topline: 5 };
const context = { breedingAttemptId: "attempt-1", litterId: "litter-1", litterOrder: 3, geneticsSeed: 914, sire: { id: "sire", traits, genotype: null, geneticsVersion: null }, dam: { id: "dam", traits: { ...traits, head: 12 }, genotype: null, geneticsVersion: null }, coiPercent: 0 };
const ordinary = generatePuppyGeneticsForBirth({ sireTraits: context.sire.traits, damTraits: context.dam.traits, coiPercent: context.coiPercent, random01: createPuppyGeneticsRandom01(context) });
const emergency = generatePuppyGeneticsForBirth({ sireTraits: context.sire.traits, damTraits: context.dam.traits, coiPercent: context.coiPercent, random01: createPuppyGeneticsRandom01({ ...context }) });
assert.deepEqual(emergency, ordinary, "ordinary and emergency contexts must produce identical current-production genetics");
const { litterOrder: _litterOrder, ...litterContext } = context;
const streamForLitter = createPuppyGeneticsRandom01ForLitter(litterContext);
const orderOne = Array.from({ length: 4 }, streamForLitter(1));
const orderThree = Array.from({ length: 4 }, streamForLitter(3));
assert.notDeepEqual(orderOne, orderThree, "litter ordinals must have independent genetics streams");
assert.deepEqual(orderThree, Array.from({ length: 4 }, streamForLitter(3)), "retry and processing order must not change a puppy stream");
assert.deepEqual(ordinary, generatePuppyGeneticsForBirth({ sireTraits: context.sire.traits, damTraits: context.dam.traits, coiPercent: context.coiPercent, random01: createPuppyGeneticsRandom01(context) }), "retry must not reroll current-production genetics");
console.log("GEN-07 reproductive genetics parity tests passed");
