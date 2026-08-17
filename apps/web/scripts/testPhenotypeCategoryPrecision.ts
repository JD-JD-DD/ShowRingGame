import assert from "node:assert/strict";

import {
  deriveVisibleCategoriesFromTraits,
  type DogTraits,
} from "@showring/rules";
import { formatGeneticCategoryValue } from "../lib/phenotypeFormat";

const traits: DogTraits = {
  head: 9.384672,
  forequarters: 9.384672,
  hindquarters: 9.384672,
  gait: 9.384672,
  coat: 9.384672,
  size: 9.384672,
  temperament: 9.384672,
  show_shine: 9.384672,
  feet: 9.384672,
  topline: 9.384672,
};

const categories = deriveVisibleCategoriesFromTraits(traits);
assert.equal(categories.typeExpression, 9.384672, "category derivation preserves available precision");
assert.equal(formatGeneticCategoryValue(9.384672), "9.385");
assert.equal(formatGeneticCategoryValue(8), "8.000");
assert.equal(formatGeneticCategoryValue(9.5), "9.500");
assert.equal(formatGeneticCategoryValue(10), "10.000");
assert.equal(categories.typeExpression, 9.384672, "directional category is not converted to a closeness score");
assert.equal(deriveVisibleCategoriesFromTraits(Object.fromEntries(Object.keys(traits).map((key) => [key, 8])) as DogTraits).typeExpression, 8);
assert.equal(deriveVisibleCategoriesFromTraits(Object.fromEntries(Object.keys(traits).map((key) => [key, 12])) as DogTraits).typeExpression, 12);

console.log("Phenotype category precision checks passed.");
