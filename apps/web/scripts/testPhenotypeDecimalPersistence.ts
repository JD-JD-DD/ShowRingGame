import assert from "node:assert/strict";
import {
  deriveVisibleCategoriesFromTraits,
  generatePuppyTraits,
  type DogTraits,
} from "@showring/rules";
import {
  toGameplayPhenotype,
  toPersistedDogTraits,
  toRulesDogTraits,
} from "@/server/services/phenotypePersistence.service";

for (const value of [0, 1, 8, 9, 10, 11, 19, 20]) {
  assert.equal(toGameplayPhenotype({ toNumber: () => value }), value);
}

const fractionalTraits: DogTraits = {
  head: 8.125,
  forequarters: 9.421357,
  hindquarters: 10.000001,
  gait: 11.875432,
  coat: 0,
  size: 1,
  temperament: 8,
  show_shine: 10,
  feet: 19,
  topline: 20,
};
assert.deepEqual(toRulesDogTraits(toPersistedDogTraits(fractionalTraits)), fractionalTraits);

const legacyIntegerTraits: DogTraits = {
  head: 8,
  forequarters: 9,
  hindquarters: 10,
  gait: 11,
  coat: 0,
  size: 1,
  temperament: 19,
  show_shine: 20,
  feet: 8,
  topline: 10,
};
assert.deepEqual(
  deriveVisibleCategoriesFromTraits(toRulesDogTraits(toPersistedDogTraits(legacyIntegerTraits))),
  deriveVisibleCategoriesFromTraits(legacyIntegerTraits)
);

const currentPuppy = generatePuppyTraits({
  sireTraits: legacyIntegerTraits,
  damTraits: legacyIntegerTraits,
  random01: () => 0.5,
});
assert.equal(Object.values(currentPuppy).every(Number.isInteger), true);

console.log("GEN-02 Decimal phenotype persistence checks passed");
