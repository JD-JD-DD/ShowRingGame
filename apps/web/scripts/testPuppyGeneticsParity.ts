import assert from "node:assert/strict";

import { CURRENT_GENETICS_VERSION, calculatePhenotypeFromGenotype, decodeGenotype, encodeGenotype, generatePuppyGeneticsForBirth, type DogTraits } from "@showring/rules";
import { createPuppyGeneticsRandom01, createPuppyGeneticsRandom01ForLitter } from "../server/services/puppyGenetics.service";

const traits: DogTraits = { head: 8, forequarters: 9, hindquarters: 10, gait: 11, coat: 12, size: 7, temperament: 13, show_shine: 6, feet: 14, topline: 5 };
const parentGenotype = encodeGenotype({ geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: 40 }, () => [-0.5, 0.5] as const) });
const context = { breedingAttemptId: "attempt-1", litterId: "litter-1", litterOrder: 3, geneticsSeed: 914, sire: { id: "sire", traits, genotype: parentGenotype, geneticsVersion: CURRENT_GENETICS_VERSION }, dam: { id: "dam", traits: { ...traits, head: 12 }, genotype: parentGenotype, geneticsVersion: CURRENT_GENETICS_VERSION }, coiPercent: 0 };
const modelInput = (random01: () => number) => ({ sireId: context.sire.id, damId: context.dam.id, sireGenotype: context.sire.genotype, sireGeneticsVersion: context.sire.geneticsVersion, damGenotype: context.dam.genotype, damGeneticsVersion: context.dam.geneticsVersion, random01 });
const ordinary = generatePuppyGeneticsForBirth(modelInput(createPuppyGeneticsRandom01(context)));
const emergency = generatePuppyGeneticsForBirth(modelInput(createPuppyGeneticsRandom01({ ...context })));
assert.deepEqual(emergency, ordinary, "ordinary and emergency contexts must produce identical current-production genetics");
assert.equal(ordinary.geneticsVersion, CURRENT_GENETICS_VERSION, "new puppies must carry the canonical genetics version");
const decoded = decodeGenotype(ordinary.genotype);
assert.equal(decoded.loci.length, 40, "Model D puppies must carry forty diploid loci");
assert.deepEqual(ordinary.traits, calculatePhenotypeFromGenotype(decoded), "persisted traits must be exactly genotype-derived");
const mendelian = generatePuppyGeneticsForBirth(modelInput(() => 0.5));
for (const [index, locus] of decodeGenotype(mendelian.genotype).loci.entries()) {
  assert.ok([-0.5, 0.5].includes(locus[0]) && [-0.5, 0.5].includes(locus[1]), `locus ${index} must receive one allele from each parent when mutation does not occur`);
}
assert.throws(() => generatePuppyGeneticsForBirth({ ...modelInput(createPuppyGeneticsRandom01(context)), sireGenotype: "invalid" }), /sire sire has an invalid/, "invalid parental genotype must fail without legacy fallback");
const { litterOrder: _litterOrder, ...litterContext } = context;
const streamForLitter = createPuppyGeneticsRandom01ForLitter(litterContext);
const orderOne = Array.from({ length: 4 }, streamForLitter(1));
const orderThree = Array.from({ length: 4 }, streamForLitter(3));
assert.notDeepEqual(orderOne, orderThree, "litter ordinals must have independent genetics streams");
assert.deepEqual(orderThree, Array.from({ length: 4 }, streamForLitter(3)), "retry and processing order must not change a puppy stream");
assert.deepEqual(ordinary, generatePuppyGeneticsForBirth(modelInput(createPuppyGeneticsRandom01(context))), "retry must not reroll current-production genetics");
console.log("GEN-08 Model D reproductive genetics parity tests passed");
