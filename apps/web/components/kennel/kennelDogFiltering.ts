export type KennelRunMembership = {
  id: string;
  name: string;
  kind: "UNCATEGORIZED" | "PLAYER" | "LITTER";
};

export type DogRunMembership = {
  dogId: string;
  kennelRunId: string | null;
};

export function filterDogsBySelectedRuns<T extends DogRunMembership>(
  dogs: T[],
  runs: KennelRunMembership[],
  selectedRunIds: string[]
): T[] {
  if (selectedRunIds.length === 0) {
    return dogs;
  }

  const selectedRunIdSet = new Set(selectedRunIds);
  const categorizedRunIds = new Set(
    runs.filter((run) => run.kind !== "UNCATEGORIZED").map((run) => run.id)
  );
  const includesUncategorized = runs.some(
    (run) =>
      run.kind === "UNCATEGORIZED" &&
      selectedRunIdSet.has(run.id)
  );

  return dogs.filter((dog) => {
    if (dog.kennelRunId && selectedRunIdSet.has(dog.kennelRunId)) {
      return true;
    }

    return (
      includesUncategorized &&
      (!dog.kennelRunId || !categorizedRunIds.has(dog.kennelRunId))
    );
  });
}
