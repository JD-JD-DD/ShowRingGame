import { strict as assert } from "node:assert";

import { matchesKennelDogSearch } from "../components/kennel/kennelDogSearch";

const dog = {
  callName: "Annie",
  registeredName: "Nightstreak Annie Get Your Gun",
  regNumber: "SRG-100",
};

assert.equal(matchesKennelDogSearch(dog, "annie"), true, "call-name partial matches");
assert.equal(matchesKennelDogSearch(dog, "ANNIE".toLowerCase()), true, "call-name matching is case-insensitive");
assert.equal(matchesKennelDogSearch(dog, "get your"), true, "registered-name partial matches");
assert.equal(matchesKennelDogSearch(dog, "100"), true, "registration-number partial matches");
assert.equal(
  matchesKennelDogSearch({ ...dog, regNumber: "BC500000001" }, "bc500"),
  true,
  "alphanumeric registration-number matching is case-insensitive"
);
assert.equal(matchesKennelDogSearch(dog, ""), true, "empty search preserves results");
assert.equal(
  matchesKennelDogSearch({ ...dog, callName: null }, "annie"),
  true,
  "null call names are safe when another identity field matches"
);
assert.equal(
  matchesKennelDogSearch({ ...dog, registeredName: null }, "annie"),
  true,
  "null registered names are safe when the call name matches"
);
assert.equal(
  matchesKennelDogSearch({ callName: null, registeredName: null, regNumber: "BC500000001" }, "bc500"),
  true,
  "null optional names do not prevent registration matching"
);

console.log("Kennel dog search checks passed.");
