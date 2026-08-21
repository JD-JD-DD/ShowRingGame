import Link from "next/link";
import { redirect } from "next/navigation";

import {
  BreedSelectOptions,
  compareBreedGroupNames,
  normalizeBreedGroupName,
} from "@/components/breeds/BreedSelectOptions";
import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { formatCompactStudOfferSummary } from "@/lib/studOfferPresentation";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import {
  hasPendingVeterinaryCareFromRecords,
  PENDING_VETERINARY_CARE_BREEDING_MESSAGE,
} from "@/server/services/emergencyVetCare.service";
import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";
import { getCurrentPublishedStudOffersForSires } from "@/server/services/studOffer.service";
import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "@/server/services/breedingEligibility.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";
import TraitLine from "@/components/ui/TraitLine";
import {
  BRUCELLOSIS_DISEASE_CODE,
  CURRENT_BREED_RELEASE,
  MIN_BREED_AGE_HOURS,
} from "@showring/rules";

type PageProps = {
  searchParams?: Promise<{
    breedCode2?: string | string[];
    group?: string | string[];
    name?: string | string[];
  }>;
};

type StudHealthConditionTruth = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function ageLabel(ageHours: number) {
  const years = Math.floor(ageHours / 365);
  const days = ageHours % 365;

  if (years <= 0) return `${days} days`;
  return `${years}y ${days}d`;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

const VISIBLE_CATEGORY_LABELS: Record<string, string> = {
  typeExpression: "Type & Expression",
  structureBalance: "Structure & Balance",
  movement: "Movement",
  coatPresentation: "Coat & Presentation",
  temperamentRingBehavior: "Temperament & Ring Behavior",
  conditioningHandling: "Conditioning & Handling",
};

function formatCategoryName(key: string): string {
  return (
    VISIBLE_CATEGORY_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function visibleCategoryEntries(categories: Record<string, number>) {
  return Object.entries(categories).filter(
    ([key]) => key !== "conditioningHandling"
  );
}

function formatGameDate(epoch: number) {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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
  healthConditionTruths: StudHealthConditionTruth[]
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

export default async function StudsPage({ searchParams }: PageProps) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedBreedCode2 =
    firstQueryValue(resolvedSearchParams.breedCode2)?.trim().toUpperCase() ?? "";
  const selectedGroup = firstQueryValue(resolvedSearchParams.group)?.trim() ?? "";
  const nameSearch = firstQueryValue(resolvedSearchParams.name)?.trim() ?? "";
  const currentEpoch = getCurrentEpoch();

  const breeds = await db.breed.findMany({
    where: {
      isActive: true,
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
    select: {
      code2: true,
      name: true,
      groupName: true,
    },
  });

  const groupOptions = Array.from(
    new Set(breeds.map((breed) => normalizeBreedGroupName(breed.groupName)))
  ).sort(compareBreedGroupNames);
  const groupBreeds = selectedGroup
    ? breeds.filter(
        (breed) => normalizeBreedGroupName(breed.groupName) === selectedGroup
      )
    : breeds;
  const selectedBreedCode2 = groupBreeds.some(
    (breed) => breed.code2 === requestedBreedCode2
  )
    ? requestedBreedCode2
    : "";
  const hasDiscoveryCriteria = Boolean(
    selectedGroup || nameSearch || selectedBreedCode2
  );

  const listings = hasDiscoveryCriteria
    ? await db.dogListing.findMany({
    where: {
      sellerType: "PLAYER",
      listingType: PLAYER_STUD_LISTING_TYPE,
      status: "ACTIVE",
      sellerKennelId: {
        not: kennel.id,
      },
      dog: {
        ...(selectedBreedCode2
          ? { breedCode2: selectedBreedCode2 }
          : selectedGroup
            ? { breedCode2: { in: groupBreeds.map((breed) => breed.code2) } }
            : {}),
        ...(nameSearch
          ? {
              OR: [
                { callName: { contains: nameSearch, mode: "insensitive" } },
                {
                  registeredName: {
                    contains: nameSearch,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        sex: "M",
        birthEpoch: {
          lte: currentEpoch - MIN_BREED_AGE_HOURS,
        },
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
    take: 60,
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
          breedCode2: true,
          birthEpoch: true,
          lifecycleState: true,
          sex: true,
          isBreedingActive: true,
          breed: {
            select: {
              name: true,
            },
          },
          ownerKennel: {
            select: {
              name: true,
            },
          },
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
          emergencyCareEvents: {
            where: { status: "PENDING" },
            take: 1,
            select: { status: true },
          },
          reproductiveEmergencies: {
            where: { status: { in: ["PENDING", "TREATMENT_AUTHORIZED"] } },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  })
    : [];
  const dogIds = listings.map((listing) => listing.dog.id);
  const currentOffers = await getCurrentPublishedStudOffersForSires(dogIds);
  const offerSummaryByDogId = new Map(
    currentOffers.map((offer) => [
      offer.sireDogId,
      formatCompactStudOfferSummary(offer),
    ])
  );

  const latestSireAttempts = dogIds.length
    ? await db.breedingAttempt.findMany({
        where: { sireId: { in: dogIds } },
        orderBy: [
          { sireId: "asc" },
          { createdEpoch: "desc" },
          { id: "desc" },
        ],
        distinct: ["sireId"],
        select: { sireId: true, createdEpoch: true },
      })
    : [];
  const latestSireAttemptEpochByDogId = new Map(
    latestSireAttempts.map((attempt) => [attempt.sireId, attempt.createdEpoch])
  );

  if (dogIds.length > 0) {
    await ensurePhenotypeHealthTruthsForDogs(db, dogIds);
  }

  const healthConditionTruths = dogIds.length
    ? await db.dogHealthConditionTruth.findMany({
        where: {
          dogId: {
            in: dogIds,
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
      })
    : [];
  const healthConditionTruthsByDogId =
    groupHealthConditionTruthsByDog(healthConditionTruths);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.22em]">
              Public Studs
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
              Browse Dogs At Stud
            </h1>
            <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
              Find eligible male dogs offered by other kennels, compare visible
              trait categories, and start a breeding with a selected public stud.
            </p>
          </div>

          <div className="theme-card theme-copy mt-5 inline-flex rounded-2xl px-4 py-2 text-sm">
            {kennel.name} balance: {formatMoney(kennel.balance)}
          </div>
        </section>

        <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
          <h2 className="theme-heading mb-4 text-lg font-semibold">Find a Stud</h2>
          <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
            <div>
              <label
                htmlFor="group"
                className="theme-label mb-1 block text-xs uppercase tracking-wide"
              >
                Group
              </label>
              <select
                id="group"
                name="group"
                defaultValue={selectedGroup}
                className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">Select a group</option>
                {groupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="name"
                className="theme-label mb-1 block text-xs uppercase tracking-wide"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                defaultValue={nameSearch}
                placeholder="Type a dog name..."
                className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="breedCode2"
                className="theme-label mb-1 block text-xs uppercase tracking-wide"
              >
                Breed
              </label>
              <select
                id="breedCode2"
                name="breedCode2"
                defaultValue={selectedBreedCode2}
                className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">Select a breed</option>
                <BreedSelectOptions options={groupBreeds} />
              </select>
            </div>

            <button
              type="submit"
              className="theme-primary-button rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              Find Studs
            </button>

            <Link
              href="/studs"
              className="theme-secondary-button rounded-xl px-5 py-2.5 text-center text-sm font-semibold"
            >
              Clear
            </Link>
          </form>
        </section>

        {!hasDiscoveryCriteria ? (
          <section className="theme-panel theme-copy rounded-[28px] p-8 text-sm">
            Choose a group, enter a name, or select a breed to find a stud.
          </section>
        ) : listings.length === 0 ? (
          <section className="theme-panel theme-copy rounded-[28px] p-8 text-sm">
            No public studs match the current filter.
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => {
              const dog = listing.dog;
              const brucellosisValidUntil = validBrucellosisUntil(
                dog,
                currentEpoch
              );
              const hasPendingVeterinaryCare = hasPendingVeterinaryCareFromRecords({
                emergencyCareEvents: dog.emergencyCareEvents,
                reproductiveEmergencies: dog.reproductiveEmergencies,
              });
              const breedingEligibility = getIndividualBreedingEligibility({
                currentEpoch,
                birthEpoch: dog.birthEpoch,
                lifecycleState: dog.lifecycleState,
                sex: dog.sex,
                latestSireAttemptCreatedEpoch:
                  latestSireAttemptEpochByDogId.get(dog.id) ?? null,
              });
              const breedingEligibilityMessage = getBreedingEligibilityMessage(
                breedingEligibility
              );
              const visibleCategories = deriveCurrentVisibleCategoriesForDogDisplay({
                storedTraits: dog,
                phenotypeHealthTruths:
                  healthConditionTruthsByDogId.get(dog.id) ??
                  dog.healthConditionTruths,
                phenotypeHealthResults: dog.healthTests,
              });
              const studOfferSummary = offerSummaryByDogId.get(dog.id) ?? null;

              return (
                <article
                  key={listing.id}
                  className="theme-panel overflow-hidden rounded-[24px]"
                >
                  <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="theme-copy text-sm font-medium">
                          {dog.breed.name}{" "}
                          <span className="theme-copy">
                            ({dog.breedCode2})
                          </span>
                        </div>
                        <h2 className="theme-heading mt-2 text-2xl font-bold">
                          {formatDogDisplayName(dog)}
                        </h2>
                        <div className="theme-copy mt-2 text-sm">
                          {dog.regNumber}
                        </div>
                      </div>

                      <div className="theme-status-info rounded-2xl px-4 py-2 text-right">
                        <div className="text-xs uppercase tracking-wide">
                          Stud Fee
                        </div>
                        <div className="mt-1 text-xl font-bold">
                          {formatMoney(listing.askingPrice)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="theme-card rounded-2xl px-4 py-3">
                        <div className="theme-label text-xs uppercase tracking-wide">
                          Owner
                        </div>
                        <div className="theme-heading mt-1 font-medium">
                          {dog.ownerKennel?.name ?? "Player Kennel"}
                        </div>
                      </div>
                      <div className="theme-card rounded-2xl px-4 py-3">
                        <div className="theme-label text-xs uppercase tracking-wide">
                          Availability
                        </div>
                        <div className="theme-heading mt-1 font-medium">
                          {!dog.isBreedingActive
                            ? "Breeding Inactive"
                            : breedingEligibility.isEligible
                              ? "Available"
                              : "Recovery"}
                        </div>
                        {dog.isBreedingActive && !breedingEligibility.isEligible && breedingEligibilityMessage ? (
                          <div className="theme-copy mt-1 text-xs">
                            {breedingEligibilityMessage}
                          </div>
                        ) : null}
                      </div>

                      <div className="theme-card rounded-2xl px-4 py-3">
                        <div className="theme-label text-xs uppercase tracking-wide">
                          Age
                        </div>
                        <div className="theme-heading mt-1 font-medium">
                          {ageLabel(Math.max(0, currentEpoch - dog.birthEpoch))}
                        </div>
                      </div>
                      <div className="theme-card rounded-2xl px-4 py-3">
                        <div className="theme-label text-xs uppercase tracking-wide">
                          Brucellosis
                        </div>
                        <div className="theme-heading mt-1 font-medium">
                          {brucellosisValidUntil === null
                            ? "No valid negative test"
                            : `Negative through ${formatGameDate(
                                brucellosisValidUntil
                              )}`}
                        </div>
                      </div>
                      <div className="theme-card rounded-2xl px-4 py-3">
                        <div className="theme-label text-xs uppercase tracking-wide">
                          Stud Terms
                        </div>
                        <div className="theme-heading mt-1 font-medium">
                          {studOfferSummary ? (
                            <span className="grid gap-1">
                              <span>Compensation: {studOfferSummary.compensationSummary}</span>
                              {studOfferSummary.puppyTermsSummary ? <span>Puppy Terms: {studOfferSummary.puppyTermsSummary}</span> : null}
                              {studOfferSummary.restrictionsSummary ? <span>Dam Requirements: {studOfferSummary.restrictionsSummary}</span> : null}
                              <span>{studOfferSummary.approvalSummary}</span>
                            </span>
                          ) : "Stud contract terms not yet published."}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="theme-label mb-3 text-sm font-semibold uppercase tracking-wide">
                        Visible Categories
                      </h3>

                      <div className="space-y-3">
                        {visibleCategoryEntries(visibleCategories).map(
                          ([key, value]) => (
                            <TraitLine
                              key={key}
                              label={formatCategoryName(key)}
                              value={value}
                              precision={3}
                              min={0}
                              max={20}
                              ideal={10}
                              leftLabel="Under ideal"
                              rightLabel="Over ideal"
                            />
                          )
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-stretch gap-3">
                      {hasPendingVeterinaryCare ? (
                        <div className="theme-status-danger flex-1 rounded-2xl px-4 py-3 text-center text-sm font-semibold">
                          {PENDING_VETERINARY_CARE_BREEDING_MESSAGE}
                        </div>
                      ) : null}
                      {!dog.isBreedingActive ? (
                        <span
                          aria-disabled="true"
                          className="theme-secondary-button flex-1 rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                        >
                          Breeding Inactive
                        </span>
                      ) : breedingEligibility.isEligible ? (
                        <Link
                          href={`/breed?studListingId=${listing.id}`}
                          className={`flex-1 rounded-2xl px-4 py-3 text-center text-sm font-semibold ${
                            hasPendingVeterinaryCare
                              ? "theme-secondary-button"
                              : "theme-primary-button"
                          }`}
                        >
                          {hasPendingVeterinaryCare ? "Review Availability" : "Use At Stud"}
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="theme-secondary-button flex-1 rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                        >
                          Stud in Recovery
                        </span>
                      )}

                      <Link
                        href={`/stud-contract?studListingId=${listing.id}&sireDogId=${dog.id}&source=public-stud`}
                        className="theme-secondary-button flex-1 rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                      >
                        Contract Terms
                      </Link>

                      <Link
                        href={`/dogs/${dog.id}`}
                        className="theme-secondary-button flex-1 rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                      >
                        View Dog
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
