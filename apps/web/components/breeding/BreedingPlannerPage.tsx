import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import BreedPageClient from "@/components/breeding/BreedPageClient";
import {
  DAM_MAX_BREED_AGE_HOURS,
  BRUCELLOSIS_DISEASE_CODE,
  MIN_BREED_AGE_HOURS,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";
import { getCurrentEpoch } from "@/lib/gameClock";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";

type BreedingPlannerPageProps = {
  experience: "breed-dog" | "worksheet";
  returnMode: "damPage" | "stayOnPlanner";
  searchParams?: Promise<{
    dogId?: string | string[];
    studListingId?: string | string[];
  }>;
};

type VisibleCategories = Record<string, number>;

type BreedingPlannerHealthConditionTruth = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

type DogCardDto = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  breedCode2: string;
  breedName: string;
  breedGroupName: string | null;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  lifecycleState: string;
  ownerKennelName: string | null;
  isOwnedByCurrentKennel: boolean;
  isListedForSale: boolean;
  isListedAtStud: boolean;
  isEligibleToBreed: boolean;
  inBreedingConflict: boolean;
  studListingId: string | null;
  studFeeAmount: number | null;
  brucellosisValidUntilEpoch: number | null;
  requiresBrucellosisNegativeDam: boolean;
  requiresDamHealthTestsCompleted: boolean;
  requiresDamHealthAllGreen: boolean;
  requiresDamHealthGreenOrYellow: boolean;
  requiresDamChampionTitle: boolean;
  coiPercent: number | null;
  lastLitterEpoch: number | null;
  healthTests: Array<{
    testTypeCode: string;
    resultCode: string;
  }>;
  visibleCategories: VisibleCategories;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function validBrucellosisUntil(
  dog: {
    infectiousDiseaseStatuses: Array<{
      diseaseCode: string;
      status: string;
    }>;
    infectiousDiseaseTests: Array<{
      diseaseCode: string;
      resultCode: string;
      validUntilEpoch: number | null;
    }>;
  },
  currentEpoch: number
): number | null {
  const infected = dog.infectiousDiseaseStatuses.some(
    (status) =>
      status.diseaseCode === BRUCELLOSIS_DISEASE_CODE &&
      status.status === "INFECTED"
  );

  if (infected) {
    return null;
  }

  return (
    dog.infectiousDiseaseTests.find(
      (test) =>
        test.diseaseCode === BRUCELLOSIS_DISEASE_CODE &&
        test.resultCode === "NEGATIVE" &&
        test.validUntilEpoch !== null &&
        test.validUntilEpoch >= currentEpoch
    )?.validUntilEpoch ?? null
  );
}

function groupHealthConditionTruthsByDog(
  healthConditionTruths: BreedingPlannerHealthConditionTruth[]
) {
  const truthsByDogId = new Map<
    string,
    Array<{
      conditionCode: string;
      geneticLiability: number;
      environmentModifier: number;
    }>
  >();

  for (const truth of healthConditionTruths) {
    const truths = truthsByDogId.get(truth.dogId) ?? [];
    truths.push({
      conditionCode: truth.conditionCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    });
    truthsByDogId.set(truth.dogId, truths);
  }

  return truthsByDogId;
}

async function ensureAndLoadBreedingPlannerHealthTruths(dogIds: string[]) {
  const uniqueDogIds = [...new Set(dogIds)];

  if (uniqueDogIds.length === 0) {
    return new Map<
      string,
      Array<{
        conditionCode: string;
        geneticLiability: number;
        environmentModifier: number;
      }>
    >();
  }

  await ensurePhenotypeHealthTruthsForDogs(db, uniqueDogIds);

  const healthConditionTruths = await db.dogHealthConditionTruth.findMany({
    where: {
      dogId: {
        in: uniqueDogIds,
      },
      conditionCode: {
        in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES],
      },
    },
    select: {
      dogId: true,
      conditionCode: true,
      geneticLiability: true,
      environmentModifier: true,
    },
  });

  return groupHealthConditionTruthsByDog(healthConditionTruths);
}

export default async function BreedingPlannerPage({
  experience,
  returnMode,
  searchParams,
}: BreedingPlannerPageProps) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      balance: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const currentEpoch = getCurrentEpoch();
  await resolveDogDeaths({ kennelId: kennel.id, currentEpoch });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialDogId = experience === "worksheet"
    ? null
    : firstQueryValue(resolvedSearchParams.dogId);
  const initialStudListingId = experience === "worksheet"
    ? null
    : firstQueryValue(resolvedSearchParams.studListingId);

  if (
    experience === "breed-dog" &&
    initialDogId === null &&
    initialStudListingId === null
  ) {
    redirect("/kennel");
  }

  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennel.id,
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
    },
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      coiPercent: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      lifecycleState: true,
      traitHead: true,
      traitForequarters: true,
      traitHindquarters: true,
      traitGait: true,
      traitCoat: true,
      traitSize: true,
      traitTemperament: true,
      traitShowShine: true,
      traitFeet: true,
      traitTopline: true,
      healthConditionTruths: {
        where: {
          conditionCode: {
            in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES],
          },
        },
        select: {
          conditionCode: true,
          geneticLiability: true,
          environmentModifier: true,
        },
      },
      breed: {
        select: {
          name: true,
          groupName: true,
        },
      },
      ownerKennel: {
        select: {
          name: true,
        },
      },
      breedingAttemptsAsDam: {
        where: {
          status: {
            in: ["INITIATED", "PREGNANT"],
          },
        },
        orderBy: [{ createdEpoch: "desc" }],
        select: { id: true, status: true },
      },
      dammedLitters: {
        orderBy: [{ bornEpoch: "desc" }],
        take: 1,
        select: {
          bornEpoch: true,
        },
      },
      healthTests: {
        where: {
          isPublic: true,
        },
        orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
        select: {
          testTypeCode: true,
          resultCode: true,
        },
      },
      infectiousDiseaseStatuses: {
        where: {
          diseaseCode: BRUCELLOSIS_DISEASE_CODE,
        },
        select: {
          diseaseCode: true,
          status: true,
        },
      },
      infectiousDiseaseTests: {
        where: {
          diseaseCode: BRUCELLOSIS_DISEASE_CODE,
        },
        orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
        select: {
          diseaseCode: true,
          resultCode: true,
          validUntilEpoch: true,
        },
      },
      listings: {
        where: {
          status: "ACTIVE",
          listingType: {
            in: [PLAYER_SALE_LISTING_TYPE, PLAYER_STUD_LISTING_TYPE],
          },
        },
        select: {
          listingType: true,
        },
      },
    },
    orderBy: [{ breedCode2: "asc" }, { birthEpoch: "asc" }],
  });
  const dogHealthConditionTruthsByDogId =
    await ensureAndLoadBreedingPlannerHealthTruths(
      dogs.map((dog) => dog.id)
    );

  const dogCards: DogCardDto[] = dogs.map((dog) => {
    const ageHours = currentEpoch - dog.birthEpoch;
    const alive = dog.lifecycleState === "ALIVE";
    const oldEnough = ageHours >= MIN_BREED_AGE_HOURS;
    const notTooOldIfFemale =
      dog.sex === "F" ? ageHours <= DAM_MAX_BREED_AGE_HOURS : true;
    const inBreedingConflict =
      dog.sex === "F" && dog.breedingAttemptsAsDam.length > 0;
    const lastLitterEpoch = dog.dammedLitters[0]?.bornEpoch ?? null;
    const inPostWhelpCooldown =
      dog.sex === "F" &&
      lastLitterEpoch !== null &&
      currentEpoch < lastLitterEpoch + WHELPING_COOLDOWN_HOURS;

    return {
      id: dog.id,
      callName: dog.callName,
      registeredName: dog.registeredName,
      regNumber: dog.regNumber,
      visibleTitlePrefix: dog.visibleTitlePrefix,
      visibleTitleSuffix: dog.visibleTitleSuffix,
      breedCode2: dog.breedCode2,
      breedName: dog.breed.name,
      breedGroupName: dog.breed.groupName,
      sex: dog.sex,
      birthEpoch: dog.birthEpoch,
      ageHours,
      lifecycleState: dog.lifecycleState,
      ownerKennelName: dog.ownerKennel?.name ?? null,
      isOwnedByCurrentKennel: true,
      isListedForSale: dog.listings.some(
        (listing) => listing.listingType === PLAYER_SALE_LISTING_TYPE
      ),
      isListedAtStud: dog.listings.some(
        (listing) => listing.listingType === PLAYER_STUD_LISTING_TYPE
      ),
      isEligibleToBreed:
        alive &&
        oldEnough &&
        notTooOldIfFemale &&
        !inBreedingConflict &&
        !inPostWhelpCooldown,
      inBreedingConflict: inBreedingConflict || inPostWhelpCooldown,
      studListingId: null,
      studFeeAmount: null,
      brucellosisValidUntilEpoch: validBrucellosisUntil(dog, currentEpoch),
      requiresBrucellosisNegativeDam: false,
      requiresDamHealthTestsCompleted: false,
      requiresDamHealthAllGreen: false,
      requiresDamHealthGreenOrYellow: false,
      requiresDamChampionTitle: false,
      coiPercent: dog.coiPercent,
      lastLitterEpoch,
      healthTests: dog.healthTests,
      visibleCategories: deriveCurrentVisibleCategoriesForDogDisplay({
        storedTraits: dog,
        phenotypeHealthTruths:
          dogHealthConditionTruthsByDogId.get(dog.id) ??
          dog.healthConditionTruths,
        phenotypeHealthResults: dog.healthTests,
      }),
    };
  });

  const activeStudDogIds = await db.dogListing.findMany({
    where: {
      sellerType: "PLAYER",
      listingType: PLAYER_STUD_LISTING_TYPE,
      status: "ACTIVE",
      sellerKennelId: {
        not: kennel.id,
      },
    },
    select: {
      dogId: true,
    },
  });

  await resolveDogDeaths({
    currentEpoch,
    dogIds: activeStudDogIds.map((listing) => listing.dogId),
  });

  const publicStudListings = await db.dogListing.findMany({
    where: {
      sellerType: "PLAYER",
      listingType: PLAYER_STUD_LISTING_TYPE,
      status: "ACTIVE",
      sellerKennelId: {
        not: kennel.id,
      },
      dog: {
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        sex: "M",
        ownerKennelId: {
          not: null,
        },
      },
    },
    orderBy: [
      { dog: { breedCode2: "asc" } },
      { askingPrice: "asc" },
      { listedAtEpoch: "desc" },
    ],
    take: 200,
    select: {
      id: true,
      askingPrice: true,
      requiresBrucellosisNegativeDam: true,
      requiresDamHealthTestsCompleted: true,
      requiresDamHealthAllGreen: true,
      requiresDamHealthGreenOrYellow: true,
      requiresDamChampionTitle: true,
      dog: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          coiPercent: true,
          breedCode2: true,
          sex: true,
          birthEpoch: true,
          lifecycleState: true,
          traitHead: true,
          traitForequarters: true,
          traitHindquarters: true,
          traitGait: true,
          traitCoat: true,
          traitSize: true,
          traitTemperament: true,
          traitShowShine: true,
          traitFeet: true,
          traitTopline: true,
          healthConditionTruths: {
            where: {
              conditionCode: {
                in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES],
              },
            },
            select: {
              conditionCode: true,
              geneticLiability: true,
              environmentModifier: true,
            },
          },
          breed: {
            select: {
              name: true,
              groupName: true,
            },
          },
          ownerKennel: {
            select: {
              name: true,
            },
          },
          healthTests: {
            where: {
              isPublic: true,
            },
            orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
            select: {
              testTypeCode: true,
              resultCode: true,
            },
          },
          infectiousDiseaseStatuses: {
            where: {
              diseaseCode: BRUCELLOSIS_DISEASE_CODE,
            },
            select: {
              diseaseCode: true,
              status: true,
            },
          },
          infectiousDiseaseTests: {
            where: {
              diseaseCode: BRUCELLOSIS_DISEASE_CODE,
            },
            orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
            select: {
              diseaseCode: true,
              resultCode: true,
              validUntilEpoch: true,
            },
          },
        },
      },
    },
  });
  const publicStudHealthConditionTruthsByDogId =
    await ensureAndLoadBreedingPlannerHealthTruths(
      publicStudListings.map((listing) => listing.dog.id)
    );

  const publicStudCards: DogCardDto[] = publicStudListings.map((listing) => {
    const dog = listing.dog;
    const ageHours = currentEpoch - dog.birthEpoch;
    const alive = dog.lifecycleState === "ALIVE";
    const oldEnough = ageHours >= MIN_BREED_AGE_HOURS;

    return {
      id: dog.id,
      callName: dog.callName,
      registeredName: dog.registeredName,
      regNumber: dog.regNumber,
      visibleTitlePrefix: dog.visibleTitlePrefix,
      visibleTitleSuffix: dog.visibleTitleSuffix,
      breedCode2: dog.breedCode2,
      breedName: dog.breed.name,
      breedGroupName: dog.breed.groupName,
      sex: dog.sex,
      birthEpoch: dog.birthEpoch,
      ageHours,
      lifecycleState: dog.lifecycleState,
      ownerKennelName: dog.ownerKennel?.name ?? null,
      isOwnedByCurrentKennel: false,
      isListedForSale: false,
      isListedAtStud: true,
      isEligibleToBreed: alive && oldEnough,
      inBreedingConflict: false,
      studListingId: listing.id,
      studFeeAmount: listing.askingPrice,
      brucellosisValidUntilEpoch: validBrucellosisUntil(dog, currentEpoch),
      requiresBrucellosisNegativeDam:
        listing.requiresBrucellosisNegativeDam,
      requiresDamHealthTestsCompleted:
        listing.requiresDamHealthTestsCompleted,
      requiresDamHealthAllGreen: listing.requiresDamHealthAllGreen,
      requiresDamHealthGreenOrYellow:
        listing.requiresDamHealthGreenOrYellow,
      requiresDamChampionTitle: listing.requiresDamChampionTitle,
      coiPercent: dog.coiPercent,
      lastLitterEpoch: null,
      healthTests: dog.healthTests,
      visibleCategories: deriveCurrentVisibleCategoriesForDogDisplay({
        storedTraits: dog,
        phenotypeHealthTruths:
          publicStudHealthConditionTruthsByDogId.get(dog.id) ??
          dog.healthConditionTruths,
        phenotypeHealthResults: dog.healthTests,
      }),
    };
  });

  if (
    experience === "breed-dog" &&
    !dogCards.some(
      (dog) => dog.id === initialDogId && dog.isEligibleToBreed
    ) &&
    !publicStudCards.some(
      (dog) =>
        dog.studListingId === initialStudListingId && dog.isEligibleToBreed
    )
  ) {
    redirect("/kennel");
  }

  const pedigree = await db.dog.findMany({
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sireId: true,
      damId: true,
    },
  });

  return (
    <main className="breeding-page mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="theme-label text-sm uppercase tracking-[0.25em]">
            Breeding
          </p>
          <h1 className="theme-heading mt-2 text-3xl font-semibold">
            {experience === "worksheet" ? "Plan A Litter" : "Breed Dog"}
          </h1>
          <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
            {experience === "worksheet"
              ? "Build a thoughtful pairing step by step. Start with a breed, compare eligible dams and sires, then review health, pedigree COI, visible trait outlook, timing, and cost before confirming the litter plan."
              : "Choose an eligible mate for this dog, review the breeding cost, and confirm the pairing."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {experience === "breed-dog" ? (
            <Link
              href="/studs"
              className="rounded-2xl border border-sky-300/25 bg-sky-500/10 px-5 py-3 text-center text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              Browse Public Studs
            </Link>
          ) : null}

          <Link
            href="/kennel"
            className="theme-secondary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
          >
            Back to My Kennel
          </Link>

          <div className="theme-card rounded-2xl px-5 py-4">
            <div className="theme-label text-xs uppercase tracking-wide">
              Kennel Balance
            </div>
            <div className="theme-heading mt-1 text-xl font-semibold">
              ${kennel.balance.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <BreedPageClient
        key={initialDogId ?? initialStudListingId ?? experience}
        experience={experience}
        returnMode={returnMode}
        kennelId={kennel.id}
        kennelName={kennel.name}
        kennelBalance={kennel.balance}
        dogs={[...dogCards, ...publicStudCards].filter(
          (dog) => dog.isEligibleToBreed
        )}
        pedigree={pedigree}
        currentEpoch={currentEpoch}
        initialDogId={initialDogId}
        initialStudListingId={initialStudListingId}
      />

      <div className="mt-8">
        <Link
          href="/kennel"
          className="theme-label text-sm font-medium transition hover:opacity-80"
        >
          ← Back to Kennel
        </Link>
      </div>
    </main>
  );
}
