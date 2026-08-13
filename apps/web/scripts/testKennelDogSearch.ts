import { strict as assert } from "node:assert";

import { matchesKennelDogSearch } from "../components/kennel/kennelDogSearch";
import { filterDogsBySelectedRuns } from "../components/kennel/kennelDogFiltering";

function normalizedSearch(query: string): string {
  return query.trim().toLowerCase();
}

function searchDogs<T extends { callName: string | null; registeredName: string | null; regNumber: string }>(
  dogs: T[],
  query: string
): T[] {
  const normalizedQuery = normalizedSearch(query);
  return dogs.filter((dog) => matchesKennelDogSearch(dog, normalizedQuery));
}

const dog = {
  callName: "Annie",
  registeredName: "Nightstreak Annie Get Your Gun",
  regNumber: "SRG-100",
};

assert.equal(searchDogs([dog], "annie").length, 1, "call-name partial matches");
assert.equal(searchDogs([dog], "AnNiE").length, 1, "call-name matching is case-insensitive");
assert.equal(searchDogs([dog], "get your").length, 1, "registered-name partial matches");
assert.equal(searchDogs([dog], "100").length, 1, "registration-number partial matches");
assert.equal(
  searchDogs([{ ...dog, regNumber: "BC500000001" }], "Bc500").length,
  1,
  "alphanumeric registration-number matching is case-insensitive"
);
assert.equal(searchDogs([dog], "").length, 1, "empty search preserves results");
assert.equal(searchDogs([dog], "   ").length, 1, "whitespace-only search preserves results");
assert.equal(searchDogs([dog], "  annie  ").length, 1, "leading and trailing query whitespace is ignored");
assert.equal(
  searchDogs([{ ...dog, callName: null }], "annie").length,
  1,
  "null call names are safe when another identity field matches"
);
assert.equal(
  searchDogs([{ ...dog, registeredName: null }], "annie").length,
  1,
  "null registered names are safe when the call name matches"
);
assert.equal(
  searchDogs([{ callName: null, registeredName: null, regNumber: "BC500000001" }], "bc500").length,
  1,
  "null optional names do not prevent registration matching"
);

const runs = [
  { id: "uncategorized", name: "Uncategorized", kind: "UNCATEGORIZED" as const },
  { id: "a", name: "Run A", kind: "PLAYER" as const },
  { id: "b", name: "Run B", kind: "PLAYER" as const },
  { id: "litter", name: "Litter", kind: "LITTER" as const },
];
const runDogs = [
  { dogId: "a", kennelRunId: "a", ...dog },
  { dogId: "b", kennelRunId: "b", ...dog },
  { dogId: "litter", kennelRunId: "litter", ...dog },
  { dogId: "uncategorized", kennelRunId: null, ...dog },
];

assert.deepEqual(
  searchDogs(filterDogsBySelectedRuns(runDogs, runs, ["a"]), "annie").map((dog) => dog.dogId),
  ["a"],
  "search cannot surface matching dogs outside the selected run"
);
assert.deepEqual(
  searchDogs(filterDogsBySelectedRuns(runDogs, runs, ["a", "b"]), "annie").map((dog) => dog.dogId),
  ["a", "b"],
  "search combines with multiple selected runs"
);
assert.deepEqual(
  searchDogs(filterDogsBySelectedRuns(runDogs, runs, ["litter"]), "annie").map((dog) => dog.dogId),
  ["litter"],
  "search treats LITTER runs as ordinary selected runs"
);
assert.deepEqual(
  searchDogs(filterDogsBySelectedRuns(runDogs, runs, ["uncategorized"]), "annie").map((dog) => dog.dogId),
  ["uncategorized"],
  "search preserves Uncategorized run semantics"
);

const largeRoster = Array.from({ length: 500 }, (_, index) => ({
  callName: index === 73 ? "Annie" : `Dog ${index}`,
  registeredName: index === 184 ? "Nightstreak Annie Get Your Gun" : `Registered ${index}`,
  regNumber: index === 291 ? "BC500000001" : `SRG-${index}`,
}));

assert.equal(searchDogs(largeRoster, "annie").length, 2, "500-dog in-memory roster searches call and registered names");
assert.equal(searchDogs(largeRoster, "500000").length, 1, "500-dog in-memory roster searches registration numbers");
assert.equal(searchDogs(largeRoster, "no such dog").length, 0, "500-dog in-memory roster keeps nonmatches excluded");

console.log("Kennel dog search checks passed.");
