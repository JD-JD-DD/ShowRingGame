import { strict as assert } from "node:assert";
import { filterDogsBySelectedRuns } from "../components/kennel/kennelDogFiltering";

const runs = [
  { id: "uncategorized", name: "Uncategorized", kind: "UNCATEGORIZED" as const },
  { id: "vl", name: "VL", kind: "PLAYER" as const },
  { id: "litter", name: "Spring Litter", kind: "LITTER" as const },
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
  filterDogsBySelectedRuns(
    [...settledDogs, { dogId: "I", kennelRunId: "litter" }],
    runs,
    ["uncategorized"]
  ).map((dog) => dog.dogId),
  ["E", "F", "G"],
  "a litter run is not treated as Uncategorized"
);

assert.deepEqual(
  filterDogsBySelectedRuns(
    [...settledDogs, { dogId: "I", kennelRunId: "litter" }],
    runs,
    ["litter"]
  ).map((dog) => dog.dogId),
  ["I"],
  "a litter run behaves as an ordinary selected run"
);

assert.deepEqual(
  filterDogsBySelectedRuns(settledDogs, runs, []).map((dog) => dog.dogId),
  ["A", "B", "E", "F", "G", "C", "D"],
  "an empty selection represents the full kennel roster"
);

type PlannerDam = {
  id: string;
  kennelRunId: string | null;
  breedCode2: string;
  sex: "M" | "F";
  isOwnedByCurrentKennel: boolean;
  isBreedingActive: boolean;
  isEligibleToBreed: boolean;
  ageHours: number;
};

const plannerDams: PlannerDam[] = [
  { id: "borzoi", kennelRunId: "girls", breedCode2: "BZ", sex: "F", isOwnedByCurrentKennel: true, isBreedingActive: true, isEligibleToBreed: true, ageHours: 80 },
  { id: "whippet", kennelRunId: "girls", breedCode2: "WH", sex: "F", isOwnedByCurrentKennel: true, isBreedingActive: true, isEligibleToBreed: true, ageHours: 60 },
  { id: "inactive", kennelRunId: "girls", breedCode2: "IS", sex: "F", isOwnedByCurrentKennel: true, isBreedingActive: false, isEligibleToBreed: true, ageHours: 100 },
  { id: "underage", kennelRunId: "girls", breedCode2: "BZ", sex: "F", isOwnedByCurrentKennel: true, isBreedingActive: true, isEligibleToBreed: false, ageHours: 10 },
  { id: "other-run", kennelRunId: "other", breedCode2: "BZ", sex: "F", isOwnedByCurrentKennel: true, isBreedingActive: true, isEligibleToBreed: true, ageHours: 120 },
  { id: "male", kennelRunId: "girls", breedCode2: "BZ", sex: "M", isOwnedByCurrentKennel: true, isBreedingActive: true, isEligibleToBreed: true, ageHours: 110 },
];

const eligiblePlannerDogs = plannerDams.filter(
  (dog) => dog.isBreedingActive && dog.isEligibleToBreed
);
const eligibleDamsInRun = (runId: string) =>
  eligiblePlannerDogs
    .filter(
      (dog) =>
        dog.isOwnedByCurrentKennel &&
        dog.sex === "F" &&
        dog.kennelRunId === runId
    )
    .sort((a, b) => b.ageHours - a.ageHours);
const eligibleDamsInBreed = (breedCode2: string) =>
  eligiblePlannerDogs
    .filter(
      (dog) =>
        dog.isOwnedByCurrentKennel &&
        dog.sex === "F" &&
        dog.breedCode2 === breedCode2
    )
    .sort((a, b) => b.ageHours - a.ageHours);

assert.deepEqual(
  eligibleDamsInRun("girls").map((dog) => dog.id),
  ["borzoi", "whippet"],
  "a mixed-breed run includes every otherwise eligible owned dam in planner age order and excludes inactive, underage, other-run, and male dogs"
);
assert.deepEqual(
  eligibleDamsInRun("other").map((dog) => dog.id),
  ["other-run"],
  "a run with one eligible dam returns exactly that dam"
);
assert.deepEqual(
  eligibleDamsInBreed("BZ").map((dog) => dog.id),
  ["other-run", "borzoi"],
  "breed mode remains independent of kennel-run assignment"
);
assert.deepEqual(
  eligibleDamsInRun("empty"),
  [],
  "an empty run has no dam candidates"
);

console.log("Kennel Run filtering checks passed.");
