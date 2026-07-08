import { strict as assert } from "node:assert";
import { filterDogsBySelectedRuns } from "../components/kennel/kennelDogFiltering";

const runs = [
  { id: "uncategorized", name: "Uncategorized", isSystem: true },
  { id: "vl", name: "VL", isSystem: false },
];
const vlDogs = ["A", "B", "C", "D"].map((dogId) => ({
  dogId,
  kennelRunId: "vl",
}));
const uncategorizedDogs = ["E", "F", "G"].map((dogId) => ({
  dogId,
  kennelRunId: "uncategorized",
}));

const initialDogs = vlDogs.slice(0, 2);
assert.deepEqual(
  filterDogsBySelectedRuns(initialDogs, runs, ["vl"]).map((dog) => dog.dogId),
  ["A", "B"],
  "the selected run is applied to the initial dog result"
);

const settledDogs = [...initialDogs, ...uncategorizedDogs, ...vlDogs.slice(2)];
assert.deepEqual(
  filterDogsBySelectedRuns(settledDogs, runs, ["vl"]).map((dog) => dog.dogId),
  ["A", "B", "C", "D"],
  "late full-roster updates cannot leak Uncategorized dogs into a selected run"
);

assert.deepEqual(
  filterDogsBySelectedRuns(settledDogs, runs, ["uncategorized"]).map(
    (dog) => dog.dogId
  ),
  ["E", "F", "G"],
  "Uncategorized includes only dogs outside user-created runs"
);

assert.deepEqual(
  filterDogsBySelectedRuns(
    [...settledDogs, { dogId: "H", kennelRunId: null }],
    runs,
    ["uncategorized"]
  ).map((dog) => dog.dogId),
  ["E", "F", "G", "H"],
  "unassigned legacy dogs are treated as Uncategorized"
);

assert.deepEqual(
  filterDogsBySelectedRuns(settledDogs, runs, []).map((dog) => dog.dogId),
  ["A", "B", "E", "F", "G", "C", "D"],
  "an empty selection represents the full kennel roster"
);

console.log("Kennel Run filtering checks passed.");
