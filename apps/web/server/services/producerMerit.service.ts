import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { CONFORMATION_CHAMPION_OF_RECORD_TITLE_CODES } from "@/lib/dogTitles";
import { formatDogDisplayName } from "@/lib/dogNames";
import { createDogProgenyTitleEarnedNotice } from "@/server/services/kennelNotice.service";

type TransactionClient = Prisma.TransactionClient;
type DbClient = typeof db | TransactionClient;
type DogSex = "M" | "F";
type ProducerMeritLevel = "NONE" | "MERIT" | "EXCELLENT" | "ELITE" | "LEGACY";

export type ProducerMeritSummary = {
  championOffspringCount: number;
  producerMeritLabel: string | null;
  producerMeritSuffix: string | null;
  producerMeritLevel: ProducerMeritLevel;
  nextMeritLabel: string | null;
  nextMeritThreshold: number | null;
};

type ProducerMeritTier = {
  level: Exclude<ProducerMeritLevel, "NONE">;
  maleThreshold: number;
  femaleThreshold: number;
  maleSuffix: string;
  femaleSuffix: string;
  maleLabel: string;
  femaleLabel: string;
};

const PRODUCER_MERIT_TIERS: ProducerMeritTier[] = [
  {
    level: "LEGACY",
    maleThreshold: 50,
    femaleThreshold: 25,
    maleSuffix: "LEGACY",
    femaleSuffix: "LEGACY",
    maleLabel: "Legacy Producer",
    femaleLabel: "Legacy Producer",
  },
  {
    level: "ELITE",
    maleThreshold: 35,
    femaleThreshold: 15,
    maleSuffix: "SOMXX",
    femaleSuffix: "DOMXX",
    maleLabel: "Elite Producer",
    femaleLabel: "Elite Producer",
  },
  {
    level: "EXCELLENT",
    maleThreshold: 20,
    femaleThreshold: 10,
    maleSuffix: "SOMX",
    femaleSuffix: "DOMX",
    maleLabel: "Excellent Producer",
    femaleLabel: "Excellent Producer",
  },
  {
    level: "MERIT",
    maleThreshold: 10,
    femaleThreshold: 5,
    maleSuffix: "SOM",
    femaleSuffix: "DOM",
    maleLabel: "Sire of Merit",
    femaleLabel: "Dam of Merit",
  },
];
const PRODUCER_MERIT_SUFFIXES = new Set(
  PRODUCER_MERIT_TIERS.flatMap((tier) => [tier.maleSuffix, tier.femaleSuffix])
);
const CHAMPION_OF_RECORD_TITLE_CODES = [
  ...CONFORMATION_CHAMPION_OF_RECORD_TITLE_CODES,
];

function thresholdForSex(tier: ProducerMeritTier, sex: DogSex): number {
  return sex === "M" ? tier.maleThreshold : tier.femaleThreshold;
}

function suffixForSex(tier: ProducerMeritTier, sex: DogSex): string {
  return sex === "M" ? tier.maleSuffix : tier.femaleSuffix;
}

function labelForSex(tier: ProducerMeritTier, sex: DogSex): string {
  return sex === "M" ? tier.maleLabel : tier.femaleLabel;
}

export function listEarnedProducerMeritTitles(args: {
  sex: DogSex;
  championOffspringCount: number;
}): Array<{
  titleCode: string;
  titleLabel: string;
}> {
  return [...PRODUCER_MERIT_TIERS]
    .reverse()
    .filter(
      (tier) => args.championOffspringCount >= thresholdForSex(tier, args.sex)
    )
    .map((tier) => ({
      titleCode: suffixForSex(tier, args.sex),
      titleLabel: labelForSex(tier, args.sex),
    }));
}

export function listNewlyEarnedProducerMeritTitles(args: {
  sex: DogSex;
  previousChampionOffspringCount: number;
  nextChampionOffspringCount: number;
}): Array<{
  titleCode: string;
  titleLabel: string;
}> {
  const previouslyEarnedTitleCodes = new Set(
    listEarnedProducerMeritTitles({
      sex: args.sex,
      championOffspringCount: args.previousChampionOffspringCount,
    }).map((title) => title.titleCode)
  );

  return listEarnedProducerMeritTitles({
    sex: args.sex,
    championOffspringCount: args.nextChampionOffspringCount,
  }).filter((title) => !previouslyEarnedTitleCodes.has(title.titleCode));
}

function composeVisibleTitleSuffix(args: {
  currentVisibleTitleSuffix: string | null;
  producerMeritSuffix: string | null;
}): string | null {
  const existingSegments =
    args.currentVisibleTitleSuffix
      ?.split(/\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment && !PRODUCER_MERIT_SUFFIXES.has(segment)) ??
    [];

  return [...existingSegments, args.producerMeritSuffix]
    .filter(Boolean)
    .join(" ") || null;
}

export function deriveProducerMeritForDog(args: {
  sex: DogSex;
  championOffspringCount: number;
}): ProducerMeritSummary {
  const earnedTier =
    PRODUCER_MERIT_TIERS.find(
      (tier) => args.championOffspringCount >= thresholdForSex(tier, args.sex)
    ) ?? null;
  const nextTier =
    [...PRODUCER_MERIT_TIERS]
      .reverse()
      .find(
        (tier) => args.championOffspringCount < thresholdForSex(tier, args.sex)
      ) ?? null;

  return {
    championOffspringCount: args.championOffspringCount,
    producerMeritLevel: earnedTier?.level ?? "NONE",
    producerMeritSuffix: earnedTier ? suffixForSex(earnedTier, args.sex) : null,
    producerMeritLabel: earnedTier ? labelForSex(earnedTier, args.sex) : null,
    nextMeritLabel: nextTier ? labelForSex(nextTier, args.sex) : null,
    nextMeritThreshold: nextTier ? thresholdForSex(nextTier, args.sex) : null,
  };
}

export async function countChampionOffspringForDog(args: {
  tx: DbClient;
  dogId: string;
}): Promise<number> {
  return args.tx.dog.count({
    where: {
      OR: [{ sireId: args.dogId }, { damId: args.dogId }],
      titleProgress: {
        is: {
          currentTitleCode: { in: CHAMPION_OF_RECORD_TITLE_CODES },
        },
      },
    },
  });
}

export async function recalculateProducerMeritForDog(args: {
  tx: DbClient;
  dogId: string;
  currentEpoch: number;
}): Promise<ProducerMeritSummary | null> {
  const dog = await args.tx.dog.findUnique({
    where: { id: args.dogId },
    select: {
      id: true,
      ownerKennelId: true,
      registeredName: true,
      callName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      sex: true,
      visibleTitleSuffix: true,
      championOffspringCount: true,
    },
  });

  if (!dog) {
    return null;
  }

  const championOffspringCount = await countChampionOffspringForDog(args);
  const merit = deriveProducerMeritForDog({
    sex: dog.sex,
    championOffspringCount,
  });
  const newlyEarnedTitles = listNewlyEarnedProducerMeritTitles({
    sex: dog.sex,
    previousChampionOffspringCount: dog.championOffspringCount,
    nextChampionOffspringCount: merit.championOffspringCount,
  });

  await args.tx.$executeRaw`
    UPDATE "Dog"
    SET
      "championOffspringCount" = ${merit.championOffspringCount},
      "producerMeritLevel" = ${merit.producerMeritLevel}::"ProducerMeritLevel",
      "producerMeritSuffix" = ${merit.producerMeritSuffix},
      "producerMeritLabel" = ${merit.producerMeritLabel},
      "visibleTitleSuffix" = ${composeVisibleTitleSuffix({
        currentVisibleTitleSuffix: dog.visibleTitleSuffix,
        producerMeritSuffix: merit.producerMeritSuffix,
      })}
    WHERE "id" = ${dog.id}
  `;

  for (const title of newlyEarnedTitles) {
    await createDogProgenyTitleEarnedNotice({
      client: args.tx,
      kennelId: dog.ownerKennelId,
      dogId: dog.id,
      dogDisplayName: formatDogDisplayName({
        registeredName: dog.registeredName,
        callName: dog.callName,
        regNumber: dog.regNumber,
        visibleTitlePrefix: dog.visibleTitlePrefix,
        visibleTitleSuffix: composeVisibleTitleSuffix({
          currentVisibleTitleSuffix: dog.visibleTitleSuffix,
          producerMeritSuffix: title.titleCode,
        }),
      }),
      titleCode: title.titleCode,
      titleLabel: title.titleLabel,
      currentEpoch: args.currentEpoch,
    });
  }

  return merit;
}

export async function recalculateProducerMeritForDogs(args: {
  tx: DbClient;
  dogIds: Array<string | null | undefined>;
  currentEpoch: number;
}) {
  const dogIds = [...new Set(args.dogIds.filter(Boolean))] as string[];

  for (const dogId of dogIds) {
    await recalculateProducerMeritForDog({
      tx: args.tx,
      dogId,
      currentEpoch: args.currentEpoch,
    });
  }
}

export async function getStoredProducerMeritForDog(args: {
  client?: DbClient;
  dogId: string;
}): Promise<ProducerMeritSummary | null> {
  const client = args.client ?? db;
  const rows = await client.$queryRaw<
    Array<{
      sex: DogSex;
      championOffspringCount: number;
    }>
  >`
    SELECT
      "sex",
      "championOffspringCount"
    FROM "Dog"
    WHERE "id" = ${args.dogId}
    LIMIT 1
  `;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return deriveProducerMeritForDog({
    sex: row.sex,
    championOffspringCount: row.championOffspringCount,
  });
}
