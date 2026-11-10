type BreedPartition<T> = Map<string, T[]>;

export function partitionKennelPrestigeSourcesByBreed<
  ChampionDog extends { breedCode2: string },
  PointAward extends { breedCode2: string },
  MajorAward extends { breedCode2: string },
  AnnualStat extends { breedCode2: string },
  GrandChampionDog extends { id: string; breedCode2: string },
  CompletionEntry extends { dogId: string; showDayId: string }
>(sources: {
  championDogs: ChampionDog[];
  pointAwards: PointAward[];
  majorAwards: MajorAward[];
  currentYearStats: AnnualStat[];
  grandChampionDogs: GrandChampionDog[];
  grandChampionCompletionEntries: CompletionEntry[];
}) {
  const groupByBreed = <T extends { breedCode2: string }>(records: T[]) => {
    const partitions: BreedPartition<T> = new Map();
    for (const record of records) {
      const partition = partitions.get(record.breedCode2) ?? [];
      partition.push(record);
      partitions.set(record.breedCode2, partition);
    }
    return partitions;
  };
  const grandChampionDogs = groupByBreed(sources.grandChampionDogs);
  const breedByGrandChampionDogId = new Map(
    sources.grandChampionDogs.map((dog) => [dog.id, dog.breedCode2])
  );
  const grandChampionCompletionEntries: BreedPartition<CompletionEntry> = new Map();
  for (const entry of sources.grandChampionCompletionEntries) {
    const breedCode2 = breedByGrandChampionDogId.get(entry.dogId);
    if (!breedCode2) continue;
    const partition = grandChampionCompletionEntries.get(breedCode2) ?? [];
    partition.push(entry);
    grandChampionCompletionEntries.set(breedCode2, partition);
  }

  const partitions = {
    championDogs: groupByBreed(sources.championDogs),
    pointAwards: groupByBreed(sources.pointAwards),
    majorAwards: groupByBreed(sources.majorAwards),
    currentYearStats: groupByBreed(sources.currentYearStats),
    grandChampionDogs,
    grandChampionCompletionEntries,
  };

  return {
    ...partitions,
    forBreed(breedCode2: string) {
      return {
        championDogs: partitions.championDogs.get(breedCode2) ?? [],
        pointAwards: partitions.pointAwards.get(breedCode2) ?? [],
        majorAwards: partitions.majorAwards.get(breedCode2) ?? [],
        currentYearStats: partitions.currentYearStats.get(breedCode2) ?? [],
        grandChampionDogs: partitions.grandChampionDogs.get(breedCode2) ?? [],
        grandChampionCompletionEntries:
          partitions.grandChampionCompletionEntries.get(breedCode2) ?? [],
      };
    },
  };
}
