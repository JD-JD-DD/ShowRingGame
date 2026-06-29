import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isChampionOfRecordDog } from "@/lib/dogTitles";

type TransactionClient = Prisma.TransactionClient;
type DbClient = typeof db | TransactionClient;

type ShowEntryForPrestige = {
  id: string;
  dogId: string;
  breedCode2: string;
  dog: {
    id: string;
    sex: "M" | "F";
    breedCode2: string;
    visibleTitlePrefix: string | null;
    breed: {
      groupName: string | null;
    };
    titleProgress: {
      currentTitleCode: string | null;
    } | null;
  };
};

type ShowAwardForPrestige = {
  dogId: string;
  awardCode: string;
  awardGroup: string;
  rank: number | null;
};

type DogCreditAccumulator = {
  dogId: string;
  breedCode2: string;
  breedDefeatedDogIds: Set<string>;
  allBreedDefeatedDogIds: Set<string>;
  breedWinCount: number;
  groupWinCount: number;
  bestInShowWinCount: number;
  reserveBisCount: number;
};

function normalizeGroupName(groupName: string | null): string {
  return groupName?.trim() || "Other Breeds";
}

function isChampionEntry(entry: ShowEntryForPrestige): boolean {
  return isChampionOfRecordDog(entry.dog);
}

function getAccumulator(
  accumulators: Map<string, DogCreditAccumulator>,
  entry: ShowEntryForPrestige
): DogCreditAccumulator {
  const existing = accumulators.get(entry.dogId);

  if (existing) {
    return existing;
  }

  const created = {
    dogId: entry.dogId,
    breedCode2: entry.breedCode2,
    breedDefeatedDogIds: new Set<string>(),
    allBreedDefeatedDogIds: new Set<string>(),
    breedWinCount: 0,
    groupWinCount: 0,
    bestInShowWinCount: 0,
    reserveBisCount: 0,
  };

  accumulators.set(entry.dogId, created);
  return created;
}

function addDefeatedDogs(
  defeatedDogIds: Set<string>,
  winnerDogId: string,
  defeatedEntries: ShowEntryForPrestige[]
) {
  // A dog may earn credit at several layers in one show. Sets prevent a BOB
  // winner who later wins the group or BIS from counting the same dog twice.
  for (const defeatedEntry of defeatedEntries) {
    if (defeatedEntry.dogId !== winnerDogId) {
      defeatedDogIds.add(defeatedEntry.dogId);
    }
  }
}

async function syncYearlyPrestigeStats(args: {
  tx: DbClient;
  dogIds: string[];
  gameYear: number;
  currentEpoch: number;
}) {
  const dogIds = [...new Set(args.dogIds)];

  if (dogIds.length === 0) {
    return;
  }

  const rollups = await args.tx.dogShowPrestigeCredit.groupBy({
    by: ["dogId", "gameYear", "breedCode2"],
    where: {
      dogId: { in: dogIds },
      gameYear: args.gameYear,
    },
    _sum: {
      breedDogsBeaten: true,
      allBreedDogsBeaten: true,
      breedWinCount: true,
      groupWinCount: true,
      bestInShowWinCount: true,
      reserveBisCount: true,
    },
  });
  const rollupByDogId = new Map(rollups.map((rollup) => [rollup.dogId, rollup]));

  for (const dogId of dogIds) {
    const rollup = rollupByDogId.get(dogId);

    if (!rollup) {
      await args.tx.dogYearlyPrestigeStat.deleteMany({
        where: {
          dogId,
          gameYear: args.gameYear,
        },
      });
      continue;
    }

    await args.tx.dogYearlyPrestigeStat.upsert({
      where: {
        dogId_gameYear: {
          dogId,
          gameYear: args.gameYear,
        },
      },
      create: {
        dogId,
        gameYear: args.gameYear,
        breedCode2: rollup.breedCode2,
        breedDogsBeaten: rollup._sum.breedDogsBeaten ?? 0,
        allBreedDogsBeaten: rollup._sum.allBreedDogsBeaten ?? 0,
        breedWinCount: rollup._sum.breedWinCount ?? 0,
        groupWinCount: rollup._sum.groupWinCount ?? 0,
        bestInShowWinCount: rollup._sum.bestInShowWinCount ?? 0,
        reserveBisCount: rollup._sum.reserveBisCount ?? 0,
        updatedAtEpoch: args.currentEpoch,
      },
      update: {
        breedCode2: rollup.breedCode2,
        breedDogsBeaten: rollup._sum.breedDogsBeaten ?? 0,
        allBreedDogsBeaten: rollup._sum.allBreedDogsBeaten ?? 0,
        breedWinCount: rollup._sum.breedWinCount ?? 0,
        groupWinCount: rollup._sum.groupWinCount ?? 0,
        bestInShowWinCount: rollup._sum.bestInShowWinCount ?? 0,
        reserveBisCount: rollup._sum.reserveBisCount ?? 0,
        updatedAtEpoch: args.currentEpoch,
      },
    });
  }
}

export async function refreshPrestigeStatsForShowDay(args: {
  tx: DbClient;
  showDayId: string;
  currentEpoch: number;
}) {
  const showDay = await args.tx.showDay.findUnique({
    where: { id: args.showDayId },
    select: {
      id: true,
      cluster: {
        select: {
          year: true,
        },
      },
      showEntries: {
        where: {
          entryStatus: "JUDGED",
        },
        select: {
          id: true,
          dogId: true,
          breedCode2: true,
          dog: {
            select: {
              id: true,
              sex: true,
              breedCode2: true,
              visibleTitlePrefix: true,
              breed: {
                select: {
                  groupName: true,
                },
              },
              titleProgress: {
                select: {
                  currentTitleCode: true,
                },
              },
            },
          },
        },
      },
      showAwards: {
        select: {
          dogId: true,
          awardCode: true,
          awardGroup: true,
          rank: true,
        },
      },
    },
  });

  if (!showDay) {
    throw new Error("Show day not found.");
  }

  const previousCredits = await args.tx.dogShowPrestigeCredit.findMany({
    where: { showDayId: args.showDayId },
    select: { dogId: true },
  });
  const previousDogIds = previousCredits.map((credit) => credit.dogId);

  await args.tx.dogShowPrestigeCredit.deleteMany({
    where: { showDayId: args.showDayId },
  });

  if (showDay.showEntries.length === 0 || showDay.showAwards.length === 0) {
    await syncYearlyPrestigeStats({
      tx: args.tx,
      dogIds: previousDogIds,
      gameYear: showDay.cluster.year,
      currentEpoch: args.currentEpoch,
    });
    await args.tx.showDay.update({
      where: { id: args.showDayId },
      data: { prestigeCalculatedAtEpoch: args.currentEpoch },
    });
    return;
  }

  const entryByDogId = new Map(
    showDay.showEntries.map((entry) => [entry.dogId, entry])
  );
  const entriesByBreed = new Map<string, ShowEntryForPrestige[]>();
  const entriesByGroup = new Map<string, ShowEntryForPrestige[]>();
  const classEntriesByBreed = new Map<string, ShowEntryForPrestige[]>();
  const classEntriesByBreedSex = new Map<string, ShowEntryForPrestige[]>();

  for (const entry of showDay.showEntries) {
    const breedEntries = entriesByBreed.get(entry.breedCode2) ?? [];
    breedEntries.push(entry);
    entriesByBreed.set(entry.breedCode2, breedEntries);

    const groupName = normalizeGroupName(entry.dog.breed.groupName);
    const groupEntries = entriesByGroup.get(groupName) ?? [];
    groupEntries.push(entry);
    entriesByGroup.set(groupName, groupEntries);

    if (!isChampionEntry(entry)) {
      const classBreedEntries = classEntriesByBreed.get(entry.breedCode2) ?? [];
      classBreedEntries.push(entry);
      classEntriesByBreed.set(entry.breedCode2, classBreedEntries);

      const sexKey = `${entry.breedCode2}:${entry.dog.sex}`;
      const classSexEntries = classEntriesByBreedSex.get(sexKey) ?? [];
      classSexEntries.push(entry);
      classEntriesByBreedSex.set(sexKey, classSexEntries);
    }
  }

  const accumulators = new Map<string, DogCreditAccumulator>();
  const awards = showDay.showAwards;
  const groupPlacementAwards = awards
    .filter((award) => award.awardGroup === "GROUP" && award.rank != null)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const groupPlacementsByGroup = new Map<string, ShowAwardForPrestige[]>();

  for (const award of groupPlacementAwards) {
    const entry = entryByDogId.get(award.dogId);

    if (!entry) {
      continue;
    }

    const groupName = normalizeGroupName(entry.dog.breed.groupName);
    const placements = groupPlacementsByGroup.get(groupName) ?? [];
    placements.push(award);
    groupPlacementsByGroup.set(groupName, placements);
  }

  for (const award of awards) {
    const entry = entryByDogId.get(award.dogId);

    if (!entry) {
      continue;
    }

    const accumulator = getAccumulator(accumulators, entry);

    if (award.awardCode === "WD" || award.awardCode === "WB") {
      const classSexEntries =
        classEntriesByBreedSex.get(`${entry.breedCode2}:${entry.dog.sex}`) ??
        [];
      addDefeatedDogs(
        accumulator.breedDefeatedDogIds,
        entry.dogId,
        classSexEntries
      );
    }

    if (award.awardCode === "BOW") {
      addDefeatedDogs(
        accumulator.breedDefeatedDogIds,
        entry.dogId,
        classEntriesByBreed.get(entry.breedCode2) ?? []
      );
    }

    if (award.awardCode === "BOB") {
      accumulator.breedWinCount += 1;
      addDefeatedDogs(
        accumulator.breedDefeatedDogIds,
        entry.dogId,
        entriesByBreed.get(entry.breedCode2) ?? []
      );
    }

    if (award.awardCode === "BOS") {
      const sameSexSpecials =
        entriesByBreed
          .get(entry.breedCode2)
          ?.filter(
            (candidate) =>
              candidate.dog.sex === entry.dog.sex && isChampionEntry(candidate)
          ) ?? [];
      addDefeatedDogs(
        accumulator.breedDefeatedDogIds,
        entry.dogId,
        [
          ...(classEntriesByBreed.get(entry.breedCode2) ?? []),
          ...sameSexSpecials,
        ]
      );
    }
  }

  for (const [groupName, groupAwards] of groupPlacementsByGroup.entries()) {
    const groupEntries = entriesByGroup.get(groupName) ?? [];

    for (const award of groupAwards) {
      const entry = entryByDogId.get(award.dogId);

      if (!entry || award.rank == null) {
        continue;
      }

      const higherPlacedBreedCodes = new Set(
        groupAwards
          .filter((candidate) => (candidate.rank ?? 99) < (award.rank ?? 99))
          .map((candidate) => entryByDogId.get(candidate.dogId)?.breedCode2)
          .filter((breedCode2): breedCode2 is string => Boolean(breedCode2))
      );
      const defeatedEntries = groupEntries.filter(
        (candidate) => !higherPlacedBreedCodes.has(candidate.breedCode2)
      );
      const accumulator = getAccumulator(accumulators, entry);

      if (award.awardCode === "G1") {
        accumulator.groupWinCount += 1;
      }

      addDefeatedDogs(
        accumulator.allBreedDefeatedDogIds,
        entry.dogId,
        defeatedEntries
      );
    }
  }

  const bisAward = awards.find((award) => award.awardCode === "BIS");
  const bisEntry = bisAward ? entryByDogId.get(bisAward.dogId) : null;
  const bisGroupName = bisEntry
    ? normalizeGroupName(bisEntry.dog.breed.groupName)
    : null;

  for (const award of awards) {
    const entry = entryByDogId.get(award.dogId);

    if (!entry) {
      continue;
    }

    const accumulator = getAccumulator(accumulators, entry);

    if (award.awardCode === "BIS") {
      accumulator.bestInShowWinCount += 1;
      addDefeatedDogs(
        accumulator.allBreedDefeatedDogIds,
        entry.dogId,
        showDay.showEntries
      );
    }

    if (award.awardCode === "RBIS") {
      accumulator.reserveBisCount += 1;
      addDefeatedDogs(
        accumulator.allBreedDefeatedDogIds,
        entry.dogId,
        showDay.showEntries.filter(
          (candidate) =>
            normalizeGroupName(candidate.dog.breed.groupName) !== bisGroupName
        )
      );
    }
  }

  const credits = [...accumulators.values()]
    .map((accumulator) => ({
      dogId: accumulator.dogId,
      showDayId: args.showDayId,
      gameYear: showDay.cluster.year,
      breedCode2: accumulator.breedCode2,
      breedDogsBeaten: accumulator.breedDefeatedDogIds.size,
      allBreedDogsBeaten: accumulator.allBreedDefeatedDogIds.size,
      breedWinCount: accumulator.breedWinCount,
      groupWinCount: accumulator.groupWinCount,
      bestInShowWinCount: accumulator.bestInShowWinCount,
      reserveBisCount: accumulator.reserveBisCount,
      calculatedAtEpoch: args.currentEpoch,
    }))
    .filter(
      (credit) =>
        credit.breedDogsBeaten > 0 ||
        credit.allBreedDogsBeaten > 0 ||
        credit.breedWinCount > 0 ||
        credit.groupWinCount > 0 ||
        credit.bestInShowWinCount > 0 ||
        credit.reserveBisCount > 0
    );

  if (credits.length > 0) {
    await args.tx.dogShowPrestigeCredit.createMany({ data: credits });
  }

  await syncYearlyPrestigeStats({
    tx: args.tx,
    dogIds: [...previousDogIds, ...credits.map((credit) => credit.dogId)],
    gameYear: showDay.cluster.year,
    currentEpoch: args.currentEpoch,
  });
  await args.tx.showDay.update({
    where: { id: args.showDayId },
    data: { prestigeCalculatedAtEpoch: args.currentEpoch },
  });
}
