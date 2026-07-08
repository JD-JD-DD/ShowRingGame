export type KennelRunMembership = {
  id: string;
  name: string;
  isSystem: boolean;
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
  const userCreatedRunIds = new Set(
    runs.filter((run) => !run.isSystem).map((run) => run.id)
  );
  const includesUncategorized = runs.some(
    (run) =>
      run.isSystem &&
      run.name === "Uncategorized" &&
      selectedRunIdSet.has(run.id)
  );

  return dogs.filter((dog) => {
    if (dog.kennelRunId && selectedRunIdSet.has(dog.kennelRunId)) {
      return true;
    }

    return (
      includesUncategorized &&
      (!dog.kennelRunId || !userCreatedRunIds.has(dog.kennelRunId))
    );
  });
}
