import assert from "node:assert/strict";

import { calculatePhenotypeFromGenotype, createFoundationDogProfile, createResetFoundationPopulationContext, decodeGenotype, type DogTraits, type FoundationPopulationContextInput } from "./index";

const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
let state = 123456;
const random01 = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
const foundation = createFoundationDogProfile({ dogId: "foundation-1", regNumber: "AB000000101", breedCode2: "AB", birthEpoch: 1, callName: "Foundation", breedBaseline: { breedCode2: "AB", traitMeans: traits }, random01 });
assert.ok(foundation.dog.genotype && foundation.dog.geneticsVersion === "showring-genotype-v1", "foundation generation must create the canonical persisted genotype");
const genotype = decodeGenotype(foundation.dog.genotype);
assert.equal(genotype.loci.length, 40, "foundation genotype must contain forty diploid loci");
assert.deepEqual(foundation.dog.traits, calculatePhenotypeFromGenotype(genotype), "foundation phenotype must be exclusively genotype-derived");
const deterministic = (context?: FoundationPopulationContextInput) => { let seed = 123456; return createFoundationDogProfile({ dogId: "foundation-2", regNumber: "AB000000102", breedCode2: "AB", birthEpoch: 1, callName: "Foundation", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext: context, random01: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; } }); };
assert.equal(deterministic(createResetFoundationPopulationContext()).dog.genotype, deterministic(createResetFoundationPopulationContext()).dog.genotype, "reset fallback must remain deterministic");
console.log("GEN-09 genotype-first foundation generation tests passed");
