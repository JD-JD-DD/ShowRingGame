import {
  BreedingAttemptStatus,
  DogLifecycleState,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { canEnterShows, CURRENT_BREED_RELEASE } from "@showring/rules";

const db = new PrismaClient();

const YEAR = 11;
const CLUSTER_ID = "invitational-year-11";
const INVITATIONAL_START_EPOCH = 4012;
const BACKFILL_EPOCH = 4019;
const TOP_DOGS_PER_BREED = 10;

function normalizeGroupName(groupName: string | null): string {
  return groupName?.trim() || "Other";
}

function groupSortKey(groupName: string): string {
  const match = groupName.match(/\d+/);

  return match ? match[0].padStart(3, "0") : groupName;
}

function getRingName(groupName: string): string {
  return groupName.toLowerCase().includes("ring")
    ? groupName
    : `${groupName} Ring`;
}

function getConditioningSnapshot(dog: {
  ringObedience: number;
  muscleTone: number;
  coatCondition: number;
}): number {
  return Math.round((dog.ringObedience + dog.muscleTone + dog.coatCondition) / 3);
}

function getDogDisplayName(dog: {
  registeredName: string | null;
  callName: string | null;
  regNumber: string;
}): string {
  return dog.registeredName?.trim() || dog.callName?.trim() || dog.regNumber;
}

function canInviteDogToInvitational(
  dog: {
    birthEpoch: number;
    lifecycleState: DogLifecycleState;
    breedingAttemptsAsDam: Array<{
      status: BreedingAttemptStatus;
      whelpedEpoch: number | null;
    }>;
  },
  invitationalStartEpoch: number
): boolean {
  const latestWhelp = dog.breedingAttemptsAsDam.find(
    (attempt) => attempt.status === "WHELPED" && attempt.whelpedEpoch !== null
  );

  return canEnterShows(
    invitationalStartEpoch,
    dog.birthEpoch,
    dog.lifecycleState,
    {
      isPregnant: dog.breedingAttemptsAsDam.some(
        (attempt) => attempt.status === "PREGNANT"
      ),
      lastWhelpedEpoch: latestWhelp?.whelpedEpoch ?? null,
    }
  );
}

async function main() {
  const cluster = await db.showCluster.findUnique({
    where: { id: CLUSTER_ID },
    include: {
      showDays: {
        orderBy: { dayIndex: "asc" },
        take: 1,
        include: {
          judgingBlocks: {
            select: {
              id: true,
              breedCode2: true,
              ringNumber: true,
              blockOrder: true,
            },
          },
          showEntries: {
            select: { dogId: true },
          },
        },
      },
    },
  });

  if (!cluster || cluster.showDays.length === 0) {
    throw new Error("Year 11 invitational show/day not found.");
  }

  const showDay = cluster.showDays[0];
  const existingDogIds = new Set(showDay.showEntries.map((entry) => entry.dogId));
  const existingBlockByBreed = new Map(
    showDay.judgingBlocks.map((block) => [block.breedCode2, block])
  );
  const breeds = await db.breed.findMany({
    where: {
      isActive: true,
      releaseVersion: { lte: CURRENT_BREED_RELEASE },
    },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
    select: { code2: true, name: true, groupName: true },
  });
  const judges = await db.judge.findMany({
    where: { isActive: true },
    orderBy: [{ judgeCode: "asc" }, { name: "asc" }],
    select: { id: true },
  });

  if (judges.length === 0) {
    throw new Error("No active judges.");
  }

  const prestigeStats = await db.dogYearlyPrestigeStat.findMany({
    where: {
      gameYear: YEAR,
      breedDogsBeaten: { gt: 0 },
      breedCode2: { in: breeds.map((breed) => breed.code2) },
    },
    orderBy: [
      { breedCode2: "asc" },
      { breedDogsBeaten: "desc" },
      { breedWinCount: "desc" },
      { allBreedDogsBeaten: "desc" },
    ],
    include: {
      dog: {
        include: {
          ownerKennel: {
            select: { id: true, name: true, slug: true },
          },
          breedingAttemptsAsDam: {
            where: {
              OR: [
                { status: "PREGNANT" },
                { status: "WHELPED", whelpedEpoch: { not: null } },
              ],
            },
            orderBy: { whelpedEpoch: "desc" },
            select: { status: true, whelpedEpoch: true },
          },
        },
      },
    },
  });
  const topTenByBreed = new Map<string, typeof prestigeStats>();

  for (const stat of prestigeStats) {
    const breedTopTen = topTenByBreed.get(stat.breedCode2) ?? [];

    if (breedTopTen.length >= TOP_DOGS_PER_BREED) {
      continue;
    }

    breedTopTen.push(stat);
    topTenByBreed.set(stat.breedCode2, breedTopTen);
  }

  const groups = [...new Set(breeds.map((breed) => normalizeGroupName(breed.groupName)))]
    .sort(
      (a, b) => groupSortKey(a).localeCompare(groupSortKey(b)) || a.localeCompare(b)
    );
  const ringByGroup = new Map<string, number>();

  for (const block of showDay.judgingBlocks) {
    const breed = breeds.find((candidate) => candidate.code2 === block.breedCode2);

    if (breed) {
      ringByGroup.set(normalizeGroupName(breed.groupName), block.ringNumber);
    }
  }

  let nextRingNumber =
    Math.max(0, ...showDay.judgingBlocks.map((block) => block.ringNumber)) + 1;

  for (const group of groups) {
    if (!ringByGroup.has(group)) {
      ringByGroup.set(group, nextRingNumber);
      nextRingNumber += 1;
    }
  }

  const blockOrderByRing = new Map<number, number>();

  for (const block of showDay.judgingBlocks) {
    blockOrderByRing.set(
      block.ringNumber,
      Math.max(blockOrderByRing.get(block.ringNumber) ?? 0, block.blockOrder)
    );
  }

  const createdBlocks: Array<{ breedCode2: string; id: string }> = [];
  const invitationEntries: Prisma.ShowEntryCreateManyInput[] = [];
  const invitationNotices: Prisma.KennelNoticeCreateManyInput[] = [];
  const skipped = {
    existingDog: 0,
    noOwner: 0,
    ineligible: 0,
  };

  await db.$transaction(async (tx) => {
    for (const breed of breeds) {
      let judgingBlockId = existingBlockByBreed.get(breed.code2)?.id;

      if (!judgingBlockId) {
        const groupName = normalizeGroupName(breed.groupName);
        const ringNumber = ringByGroup.get(groupName) ?? nextRingNumber++;
        const blockOrder = (blockOrderByRing.get(ringNumber) ?? 0) + 1;
        const judge = judges[(YEAR + ringNumber + blockOrder) % judges.length];

        blockOrderByRing.set(ringNumber, blockOrder);

        const judgingBlock = await tx.showJudgingBlock.create({
          data: {
            showDayId: showDay.id,
            judgeId: judge.id,
            breedCode2: breed.code2,
            ringNumber,
            ringName: getRingName(groupName),
            startEpoch: INVITATIONAL_START_EPOCH,
            classType: "INVITATIONAL",
            blockOrder,
            entryCountHint: topTenByBreed.get(breed.code2)?.length ?? 0,
            status: "ENTRY_LOCKED",
          },
          select: { id: true },
        });

        judgingBlockId = judgingBlock.id;
        createdBlocks.push({ breedCode2: breed.code2, id: judgingBlock.id });
      }

      const rankedDogs = topTenByBreed.get(breed.code2) ?? [];

      for (const [rankIndex, stat] of rankedDogs.entries()) {
        if (existingDogIds.has(stat.dog.id)) {
          skipped.existingDog += 1;
          continue;
        }

        const ownerKennel = stat.dog.ownerKennel;

        if (!ownerKennel) {
          skipped.noOwner += 1;
          continue;
        }

        if (!canInviteDogToInvitational(stat.dog, INVITATIONAL_START_EPOCH)) {
          skipped.ineligible += 1;
          continue;
        }

        existingDogIds.add(stat.dog.id);
        invitationEntries.push({
          showDayId: showDay.id,
          judgingBlockId,
          dogId: stat.dog.id,
          kennelId: ownerKennel.id,
          enteredKennelId: ownerKennel.id,
          enteredKennelName: ownerKennel.name,
          enteredKennelSlug: ownerKennel.slug,
          breedCode2: breed.code2,
          entryStatus: "ENTERED" as const,
          enteredAtEpoch: BACKFILL_EPOCH,
          feeCharged: 0,
          handlerUsed: false,
          conditioningSnapshot: getConditioningSnapshot(stat.dog),
          fatigueSnapshot: stat.dog.fatiguePoints,
        });
        invitationNotices.push({
          kennelId: ownerKennel.id,
          type: "INVITATIONAL_INVITE" as const,
          title: "Invitational show invitation",
          body: `Your dog ${getDogDisplayName(stat.dog)} has been invited to Year ${YEAR}'s invitational show. Congratulations.`,
          createdAtEpoch: BACKFILL_EPOCH,
          linkedDogId: stat.dog.id,
          linkedShowId: CLUSTER_ID,
          metadataJson: {
            gameYear: YEAR,
            breedCode2: breed.code2,
            rank: rankIndex + 1,
          },
        });
      }
    }

    if (invitationEntries.length > 0) {
      await tx.showEntry.createMany({ data: invitationEntries });
    }

    if (invitationNotices.length > 0) {
      await tx.kennelNotice.createMany({ data: invitationNotices });
    }

    await tx.showAward.deleteMany({
      where: {
        showDayId: showDay.id,
        awardGroup: { in: ["GROUP", "BEST_IN_SHOW"] },
      },
    });
    await tx.showDay.update({
      where: { id: showDay.id },
      data: { prestigeCalculatedAtEpoch: null },
    });
  }, {
    timeout: 60_000,
  });

  console.log(JSON.stringify({
    breedsConsidered: breeds.length,
    createdBlocks: createdBlocks.length,
    createdEntries: invitationEntries.length,
    createdNotices: invitationNotices.length,
    skipped,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
