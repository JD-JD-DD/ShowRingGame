import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import { deriveVisibleCategoriesFromTraits } from "@showring/rules";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
  PUPPY_SALE_MIN_AGE_HOURS,
  WHELPING_COOLDOWN_HOURS,
  getPuppyRehomePayoutForAgeHours,
  getShowDistrictRegionName,
} from "@showring/rules";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import ManageDogStudListingForm from "@/components/dogs/ManageDogStudListingForm";
import OfferDogAtStudForm from "@/components/dogs/OfferDogAtStudForm";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import RehomeDogForm from "@/components/dogs/RehomeDogForm";
import TraitLine from "@/components/ui/TraitLine";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";

const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;

type PageProps = {
  params: Promise<{
    dogId: string;
  }>;
  searchParams?: Promise<{
    nameError?: string | string[];
    saleError?: string | string[];
    saleMessage?: string | string[];
  }>;
};

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
  }

  return `${weeks}w`;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatListingType(listingType: string): string {
  if (listingType === PLAYER_SALE_LISTING_TYPE) return "For Sale";
  if (listingType === PLAYER_STUD_LISTING_TYPE) return "At Stud";
  return listingType;
}

function formatSireHistoryStatus(status: string): string {
  switch (status) {
    case "INITIATED":
      return "Awaiting pregnancy check";
    case "CHECKED_NOT_PREGNANT":
      return "Did not take";
    case "PREGNANT":
      return "Pregnant";
    case "WHELPED":
      return "Whelped";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function sortShowAwards<
  T extends {
    awardCode: string;
    awardGroup: string;
    rank: number | null;
    pointsAwarded: number;
  },
>(awards: T[]): T[] {
  const awardOrder: Record<string, number> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    WD: 5,
    WB: 5,
    RWD: 6,
    RWB: 6,
    BOW: 7,
    BOB: 8,
    BOS: 9,
    AOM: 10,
    G1: 11,
    G2: 12,
    G3: 13,
    G4: 14,
    BIS: 15,
    RBIS: 16,
  };

  return [...awards].sort((a, b) => {
    const orderDifference =
      (awardOrder[a.awardCode] ?? 99) - (awardOrder[b.awardCode] ?? 99);

    if (orderDifference !== 0) return orderDifference;

    return (a.rank ?? 99) - (b.rank ?? 99);
  });
}

type ChampionshipPointWin = {
  showDayId: string;
  awardCode: string;
  pointsAwarded: number;
  isMajor: boolean;
};

type PedigreeDog = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  sireId: string | null;
  damId: string | null;
};

function getChampionshipPointWins(value: unknown): ChampionshipPointWin[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray(
      (value as { championshipPointWins?: unknown }).championshipPointWins
    )
  ) {
    return [];
  }

  return (value as { championshipPointWins: unknown[] }).championshipPointWins
    .filter(
      (win): win is ChampionshipPointWin =>
        typeof win === "object" &&
        win !== null &&
        typeof (win as ChampionshipPointWin).showDayId === "string" &&
        typeof (win as ChampionshipPointWin).awardCode === "string" &&
        typeof (win as ChampionshipPointWin).pointsAwarded === "number" &&
        typeof (win as ChampionshipPointWin).isMajor === "boolean"
    )
    .slice(-5)
    .reverse();
}

async function getPedigreeAncestors(rootDog: {
  sireId: string | null;
  damId: string | null;
}): Promise<Map<string, PedigreeDog>> {
  const ancestors = new Map<string, PedigreeDog>();
  let dogIds = [rootDog.sireId, rootDog.damId].filter(
    (dogId): dogId is string => Boolean(dogId)
  );

  for (let generation = 0; generation < 4 && dogIds.length > 0; generation += 1) {
    const dogs = await db.dog.findMany({
      where: {
        id: {
          in: [...new Set(dogIds)],
        },
      },
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

    for (const dog of dogs) {
      ancestors.set(dog.id, dog);
    }

    dogIds = dogs
      .flatMap((dog) => [dog.sireId, dog.damId])
      .filter((dogId): dogId is string => Boolean(dogId));
  }

  return ancestors;
}

function getPedigreeParent(
  ancestors: Map<string, PedigreeDog>,
  dog: { sireId: string | null; damId: string | null } | null | undefined,
  parent: "sireId" | "damId"
): PedigreeDog | null {
  const dogId = dog?.[parent];

  return dogId ? ancestors.get(dogId) ?? null : null;
}

function PedigreeCard({
  dog,
  relationship,
  column,
  rowStart,
  rowSpan,
}: {
  dog: PedigreeDog | null;
  relationship: string;
  column: number;
  rowStart: number;
  rowSpan: number;
}) {
  const className =
    "flex min-h-0 flex-col justify-center rounded-2xl border border-white/10 bg-black/20 px-3 py-2 transition";
  const content = (
    <>
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-purple-200/70">
        {relationship}
      </div>
      <div className="mt-1 text-sm font-semibold leading-tight text-white">
        {dog ? formatDogDisplayName(dog) : "Unknown"}
      </div>
      {dog ? (
        <div className="mt-1 truncate text-[0.68rem] text-purple-100/55">
          {dog.regNumber}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] text-purple-100/55">
        <span>Color: Pending</span>
        <span>Health: Pending</span>
      </div>
    </>
  );
  const style = {
    gridColumn: column,
    gridRow: `${rowStart} / span ${rowSpan}`,
  };

  return dog ? (
    <Link
      href={`/dogs/${dog.id}`}
      style={style}
      className={`${className} hover:border-purple-300/45 hover:bg-white/10`}
    >
      {content}
    </Link>
  ) : (
    <div style={style} className={`${className} border-dashed opacity-65`}>
      {content}
    </div>
  );
}

export default async function DogPage({ params, searchParams }: PageProps) {
  const { dogId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const nameError = firstQueryValue(resolvedSearchParams.nameError);
  const saleError = firstQueryValue(resolvedSearchParams.saleError);
  const saleMessage = firstQueryValue(resolvedSearchParams.saleMessage);
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const currentEpoch = getCurrentEpoch();

  const currentKennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      balance: true,
      homeDistrict: true,
    },
  });

  if (!currentKennel) {
    redirect("/onboarding");
  }

  await resolveDogDeaths({ currentEpoch, dogIds: [dogId] });

  const dog = await db.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      deathEpoch: true,
      lifecycleState: true,
      marketState: true,
      originType: true,
      isFoundation: true,
      sireId: true,
      damId: true,
      coiPercent: true,
      coiGenerationDepth: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      titleProgress: {
        select: {
          championshipPoints: true,
          majorCount: true,
          currentTitleCode: true,
          winsByTypeJson: true,
        },
      },
      notesPublic: true,
      ringObedience: true,
      muscleTone: true,
      coatCondition: true,
      fatiguePoints: true,
      breed: {
        select: {
          name: true,
          code2: true,
        },
      },
      ownerKennel: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      breederKennel: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      sireOf: {
        orderBy: [{ birthEpoch: "desc" }, { regNumber: "asc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          sex: true,
        },
      },
      damOf: {
        orderBy: [{ birthEpoch: "desc" }, { regNumber: "asc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          sex: true,
        },
      },
      showResults: {
        orderBy: [{ publishedAtEpoch: "desc" }, { finalRank: "asc" }],
        take: 20,
        select: {
          id: true,
          finalRank: true,
          placementCode: true,
          pointsAwarded: true,
          isMajor: true,
          breed: {
            select: {
              name: true,
              code2: true,
            },
          },
          judge: {
            select: {
              judgeCode: true,
              name: true,
            },
          },
          showDay: {
            select: {
              dayIndex: true,
              scheduledEpoch: true,
              cluster: {
                select: {
                  id: true,
                  name: true,
                  district: true,
                },
              },
            },
          },
          showAwards: {
            select: {
              awardCode: true,
              awardGroup: true,
              rank: true,
              pointsAwarded: true,
              isMajor: true,
            },
          },
        },
      },
      breedingAttemptsAsDam: {
        where: {
          OR: [
            {
              status: {
                in: ["INITIATED", "PREGNANT"],
              },
            },
            {
              status: "WHELPED",
              whelpedEpoch: {
                not: null,
                gt: currentEpoch - WHELPING_COOLDOWN_HOURS,
              },
            },
          ],
        },
        select: {
          id: true,
        },
      },
      breedingAttemptsAsSire: {
        orderBy: [{ createdEpoch: "desc" }],
        select: {
          id: true,
          createdEpoch: true,
          status: true,
          litterId: true,
          createdByKennel: {
            select: {
              name: true,
              slug: true,
            },
          },
          dam: {
            select: {
              id: true,
              callName: true,
              registeredName: true,
              regNumber: true,
              visibleTitlePrefix: true,
              visibleTitleSuffix: true,
            },
          },
        },
      },
      listings: {
        where: {
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          askingPrice: true,
          sellerType: true,
          descriptionPublic: true,
          listingType: true,
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
    },
  });

  if (!dog) {
    notFound();
  }

  const pedigreeAncestors = await getPedigreeAncestors(dog);
  const pedigreeSire = getPedigreeParent(pedigreeAncestors, dog, "sireId");
  const pedigreeDam = getPedigreeParent(pedigreeAncestors, dog, "damId");
  const pedigreeSireSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSire,
    "sireId"
  );
  const pedigreeSireDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSire,
    "damId"
  );
  const pedigreeDamSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDam,
    "sireId"
  );
  const pedigreeDamDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDam,
    "damId"
  );
  const pedigreeSireSireSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireSire,
    "sireId"
  );
  const pedigreeSireSireDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireSire,
    "damId"
  );
  const pedigreeSireDamSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireDam,
    "sireId"
  );
  const pedigreeSireDamDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireDam,
    "damId"
  );
  const pedigreeDamSireSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamSire,
    "sireId"
  );
  const pedigreeDamSireDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamSire,
    "damId"
  );
  const pedigreeDamDamSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamDam,
    "sireId"
  );
  const pedigreeDamDamDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamDam,
    "damId"
  );
  const ageHours = Math.max(0, currentEpoch - dog.birthEpoch);
  const rehomePayout = getPuppyRehomePayoutForAgeHours(ageHours);

  const visibleCategories = deriveVisibleCategoriesFromTraits({
    head: dog.traitHead,
    forequarters: dog.traitForequarters,
    hindquarters: dog.traitHindquarters,
    gait: dog.traitGait,
    coat: dog.traitCoat,
    size: dog.traitSize,
    temperament: dog.traitTemperament,
    show_shine: dog.traitShowShine,
    feet: dog.traitFeet,
    topline: dog.traitTopline,
  });

  const isOwnedByCurrentKennel = dog.ownerKennel?.id === currentKennel.id;
  const activeSaleListing =
    dog.listings.find(
      (listing) => listing.listingType === PLAYER_SALE_LISTING_TYPE
    ) ?? null;
  const activeStudListing =
    dog.listings.find(
      (listing) => listing.listingType === PLAYER_STUD_LISTING_TYPE
    ) ?? null;
  const activeListing =
    activeSaleListing ?? activeStudListing ?? dog.listings[0] ?? null;
  const isAlive = dog.lifecycleState === "ALIVE";
  const isListedForSale =
    !!activeSaleListing &&
    (dog.marketState === "LISTED_NPC" || dog.marketState === "LISTED_PLAYER");
  const canBuyActiveListing =
    isListedForSale && isAlive && !isOwnedByCurrentKennel;
  const canUseActiveStudListing =
    !!activeStudListing && isAlive && dog.sex === "M" && !isOwnedByCurrentKennel;

  const canBreed =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    (dog.sex === "M" ||
      (ageHours <= DAM_MAX_BREED_AGE_HOURS &&
        dog.breedingAttemptsAsDam.length === 0));

  const displayName = formatDogDisplayName(dog);
  const canNameDog = isOwnedByCurrentKennel && !dog.registeredName?.trim();
  const canOfferForSale =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= PUPPY_SALE_MIN_AGE_HOURS &&
    dog.marketState === "NOT_FOR_SALE" &&
    !activeListing;
  const canOfferAtStud =
    isOwnedByCurrentKennel &&
    isAlive &&
    dog.sex === "M" &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    dog.marketState === "NOT_FOR_SALE" &&
    !activeListing;

  const categoryEntries = Object.entries(visibleCategories);
  const progeny = dog.sex === "M" ? dog.sireOf : dog.damOf;
  const showResults = dog.showResults;
  const totalShowPoints = showResults.reduce(
    (total, result) => total + result.pointsAwarded,
    0
  );
  const championshipPoints = dog.titleProgress?.championshipPoints ?? 0;
  const majorCount = dog.titleProgress?.majorCount ?? 0;
  const currentTitleCode = dog.titleProgress?.currentTitleCode ?? null;
  const pointsNeeded = Math.max(
    0,
    CHAMPIONSHIP_POINTS_REQUIRED - championshipPoints
  );
  const majorsNeeded = Math.max(0, CHAMPIONSHIP_MAJORS_REQUIRED - majorCount);
  const championshipPointWins = getChampionshipPointWins(
    dog.titleProgress?.winsByTypeJson
  );

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Show Profile
              </div>

              <div className="text-sm font-medium text-purple-200">
                {dog.breed.name}{" "}
                <span className="text-purple-100/60">({dog.breedCode2})</span>
              </div>

              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {displayName}
              </h1>

              <div className="mt-3 text-sm text-purple-100/70">
                {dog.regNumber}
              </div>

              {canNameDog ? (
                <RegisterDogNameForm
                  action={`/api/dogs/${dog.id}/rename`}
                  nameError={nameError}
                />
              ) : null}

              {(dog.visibleTitlePrefix || dog.visibleTitleSuffix) && (
                <div className="mt-3 text-sm text-purple-100/80">
                  {[dog.visibleTitlePrefix, dog.visibleTitleSuffix]
                    .filter(Boolean)
                    .join(" / ")}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-purple-100">
                  Sex: {dog.sex}
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-purple-100">
                  Age: {formatAge(ageHours)}
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-purple-100">
                  Status: {dog.lifecycleState}
                </div>
                {dog.deathEpoch !== null ? (
                  <div className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100">
                    Died: {formatShowDate(dog.deathEpoch)}
                  </div>
                ) : null}
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-purple-100">
                  Origin: {dog.originType}
                </div>
                {dog.isFoundation ? (
                  <div className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100">
                    Foundation Dog
                  </div>
                ) : null}
                {isListedForSale ? (
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    Listed for Sale
                  </div>
                ) : null}
                {activeStudListing ? (
                  <div className="rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                    At Stud
                  </div>
                ) : null}
              </div>

              {saleMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {saleMessage}
                </div>
              ) : null}

              {saleError ? (
                <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {saleError}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
              <Link
                href="/kennel"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Back to My Kennel
              </Link>

              {canBreed ? (
                <Link
                  href={`/breed?dogId=${dog.id}`}
                  className="rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  Breed Dog
                </Link>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-center text-sm font-semibold text-purple-100/45">
                  Breed Dog
                </div>
              )}

              {canBuyActiveListing && activeSaleListing ? (
                <form
                  action={`/api/market-dogs/${activeSaleListing.id}/buy`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Buy for {formatMoney(activeSaleListing.askingPrice)}
                  </button>
                </form>
              ) : null}

              {canUseActiveStudListing && activeStudListing ? (
                <Link
                  href={`/breed?studListingId=${activeStudListing.id}`}
                  className="rounded-2xl bg-sky-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Use At Stud for {formatMoney(activeStudListing.askingPrice)}
                </Link>
              ) : null}

              {canOfferForSale ? (
                <OfferDogForSaleForm
                  action={`/api/dogs/${dog.id}/list-for-sale`}
                />
              ) : isOwnedByCurrentKennel && activeSaleListing ? (
                <ManageDogListingForm
                  dogId={dog.id}
                  listingId={activeSaleListing.id}
                  currentPrice={activeSaleListing.askingPrice}
                  updateAction={`/api/market-dogs/${activeSaleListing.id}/update-price`}
                  cancelAction={`/api/market-dogs/${activeSaleListing.id}/cancel`}
                />
              ) : null}

              {canOfferAtStud ? (
                <OfferDogAtStudForm
                  action={`/api/dogs/${dog.id}/list-at-stud`}
                />
              ) : isOwnedByCurrentKennel && activeStudListing ? (
                <ManageDogStudListingForm
                  dogId={dog.id}
                  listingId={activeStudListing.id}
                  currentPrice={activeStudListing.askingPrice}
                  updateAction={`/api/stud-listings/${activeStudListing.id}/update-price`}
                  cancelAction={`/api/stud-listings/${activeStudListing.id}/cancel`}
                />
              ) : null}

              {isOwnedByCurrentKennel &&
              isAlive &&
              ageHours >= PUPPY_SALE_MIN_AGE_HOURS &&
              dog.marketState === "NOT_FOR_SALE" &&
              !activeListing ? (
                <RehomeDogForm
                  action={`/api/dogs/${dog.id}/rehome`}
                  dogName={displayName}
                  payout={rehomePayout}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
            <h2 className="text-2xl font-semibold text-white">
              Visible Trait Categories
            </h2>
            <p className="mt-2 text-sm leading-7 text-purple-100/70">
              Player-facing trait summaries shown on a 0–20 scale, with 10 as ideal.
            </p>

            <div className="mt-6 space-y-4">
              {categoryEntries.map(([key, value]) => (
                <TraitLine
                  key={key}
                  label={formatCategoryName(key)}
                  value={value}
                  min={0}
                  max={20}
                  ideal={10}
                  leftLabel="Poor"
                  rightLabel="Poor"
                />
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <h2 className="text-xl font-semibold text-white">Identity</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Breed
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.breed.name} ({dog.breedCode2})
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Registration
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.regNumber}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Owner
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.ownerKennel?.name ?? "Unowned"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Breeder
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.breederKennel?.name ?? "System"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <h2 className="text-xl font-semibold text-white">Current Status</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Lifecycle
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.lifecycleState}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Market State
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.marketState}
                  </div>
                </div>

                {dog.deathEpoch !== null ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200">
                      Death Date
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {formatShowDate(dog.deathEpoch)}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Show Eligibility
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {isAlive &&
                    ageHours >= MIN_SHOW_AGE_HOURS &&
                    ageHours <= MAX_SHOW_AGE_HOURS
                      ? "Eligible"
                      : "Not eligible"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Breeding Eligibility
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {canBreed ? "Eligible" : "Not eligible"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Title Progress
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-purple-100/65">
                    Championship requires 15 points and 2 major wins. Majors are
                    3, 4, or 5 point wins.
                  </p>
                </div>
                {currentTitleCode ? (
                  <span className="rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">
                    {currentTitleCode}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Points
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {championshipPoints}/{CHAMPIONSHIP_POINTS_REQUIRED}
                  </div>
                  <div className="mt-1 text-xs text-purple-100/55">
                    {pointsNeeded === 0
                      ? "Point requirement met"
                      : `${pointsNeeded} more needed`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Majors
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {majorCount}/{CHAMPIONSHIP_MAJORS_REQUIRED}
                  </div>
                  <div className="mt-1 text-xs text-purple-100/55">
                    {majorsNeeded === 0
                      ? "Major requirement met"
                      : `${majorsNeeded} more needed`}
                  </div>
                </div>
              </div>

              {championshipPointWins.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Recent Point Wins
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {championshipPointWins.map((win) => (
                      <span
                        key={`${win.showDayId}-${win.awardCode}`}
                        className="rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100"
                      >
                        {win.awardCode} - {win.pointsAwarded} pt
                        {win.pointsAwarded === 1 ? "" : "s"}
                        {win.isMajor ? " major" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

          </div>
        </section>

        <section className="mb-8 rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-white">Show Record</h2>
              <p className="mt-2 text-sm leading-7 text-purple-100/70">
                Published breed results for this dog.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-semibold text-purple-100/75">
              {showResults.length} result{showResults.length === 1 ? "" : "s"} -{" "}
              {totalShowPoints} point{totalShowPoints === 1 ? "" : "s"}
            </div>
          </div>

          {showResults.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/75">
              No published show results yet.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                    <th className="px-3 py-2">Show</th>
                    <th className="px-3 py-2">Breed</th>
                    <th className="px-3 py-2">Judge</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {showResults.map((result) => {
                    const sortedAwards = sortShowAwards(result.showAwards);

                    return (
                      <tr
                        key={result.id}
                        className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                      >
                        <td className="rounded-l-2xl px-3 py-3">
                          <Link
                            href={`/shows/${result.showDay.cluster.id}`}
                            className="font-semibold text-white underline-offset-4 hover:underline"
                          >
                            {result.showDay.cluster.name}
                          </Link>
                          <div className="text-xs text-purple-100/55">
                            {formatShowDate(result.showDay.scheduledEpoch)} - Day{" "}
                            {result.showDay.dayIndex} -{" "}
                            {getShowDistrictRegionName(
                              result.showDay.cluster.district
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/shows/${result.showDay.cluster.id}/results/${result.breed.code2}`}
                            className="font-semibold text-sky-100 underline-offset-4 hover:underline"
                          >
                            {result.breed.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/judges/${result.judge.judgeCode}`}
                            className="font-semibold text-white underline-offset-4 hover:underline"
                          >
                            {result.judge.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          {sortedAwards.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {sortedAwards.map((award) => (
                                <span
                                  key={`${result.id}-${award.awardCode}-${award.awardGroup}-${award.rank ?? "na"}`}
                                  className="rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100"
                                >
                                  {award.awardCode}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-purple-100/45">None</span>
                          )}
                        </td>
                        <td className="rounded-r-2xl px-3 py-3 text-right font-semibold text-white">
                          {result.pointsAwarded}
                          {result.isMajor ? (
                            <div className="text-xs font-medium text-amber-100">
                              Major
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {dog.sex === "M" && isOwnedByCurrentKennel ? (
          <section className="mb-8 rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-semibold text-white">Sire History</h2>
            <p className="mt-2 text-sm leading-7 text-purple-100/70">
              Breeding uses recorded for this dog, including outside stud
              services.
            </p>

            {dog.breedingAttemptsAsSire.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {dog.breedingAttemptsAsSire.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-purple-100/80">
                      {attempt.createdByKennel ? (
                        <Link
                          href={`/kennels/${attempt.createdByKennel.slug}`}
                          className="font-semibold text-white underline-offset-4 hover:underline"
                        >
                          {attempt.createdByKennel.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-white">
                          Unknown kennel
                        </span>
                      )}{" "}
                      used him on {formatShowDate(attempt.createdEpoch)} with{" "}
                      <Link
                        href={`/dogs/${attempt.dam.id}`}
                        className="font-semibold text-white underline-offset-4 hover:underline"
                      >
                        {formatDogDisplayName(attempt.dam)}
                      </Link>
                      .
                    </div>
                    <div className="shrink-0">
                      {attempt.litterId ? (
                        <Link
                          href={`/litters/${attempt.litterId}`}
                          className="font-semibold text-emerald-100 underline-offset-4 hover:underline"
                        >
                          Litter
                        </Link>
                      ) : (
                        <span
                          className={
                            attempt.status === "CHECKED_NOT_PREGNANT"
                              ? "font-semibold text-amber-100"
                              : "text-purple-100/65"
                          }
                        >
                          {formatSireHistoryStatus(attempt.status)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/75">
                No breeding uses recorded.
              </div>
            )}
          </section>
        ) : null}

        <section className="mb-8 rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Four-Generation Pedigree
              </h2>
              <p className="mt-2 text-sm leading-7 text-purple-100/70">
                Traditional pedigree order with sires above dams. Select any
                recorded ancestor to open that dog&apos;s profile.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-100">
                COI:{" "}
                {dog.coiPercent === null
                  ? "Pending"
                  : `${dog.coiPercent.toFixed(2)}%`}
              </span>
              {dog.coiPercent !== null && dog.coiGenerationDepth !== null ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-purple-100/70">
                  {dog.coiGenerationDepth} generation calculation
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-purple-100/70">
                Color: Pending
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-purple-100/70">
                Health tests: Pending
              </span>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <div className="grid min-w-[1440px] grid-cols-4 gap-3 text-xs">
              <div className="font-semibold uppercase tracking-[0.18em] text-purple-200/75">
                Parents
              </div>
              <div className="font-semibold uppercase tracking-[0.18em] text-purple-200/75">
                Grandparents
              </div>
              <div className="font-semibold uppercase tracking-[0.18em] text-purple-200/75">
                Great-Grandparents
              </div>
              <div className="font-semibold uppercase tracking-[0.18em] text-purple-200/75">
                Great-Great-Grandparents
              </div>
            </div>
            <div className="mt-3 grid min-w-[1440px] grid-cols-4 grid-rows-16 gap-3">
              <PedigreeCard dog={pedigreeSire} relationship="Sire" column={1} rowStart={1} rowSpan={8} />
              <PedigreeCard dog={pedigreeDam} relationship="Dam" column={1} rowStart={9} rowSpan={8} />
              <PedigreeCard dog={pedigreeSireSire} relationship="Sire's Sire" column={2} rowStart={1} rowSpan={4} />
              <PedigreeCard dog={pedigreeSireDam} relationship="Sire's Dam" column={2} rowStart={5} rowSpan={4} />
              <PedigreeCard dog={pedigreeDamSire} relationship="Dam's Sire" column={2} rowStart={9} rowSpan={4} />
              <PedigreeCard dog={pedigreeDamDam} relationship="Dam's Dam" column={2} rowStart={13} rowSpan={4} />
              <PedigreeCard dog={pedigreeSireSireSire} relationship="Sire's Sire's Sire" column={3} rowStart={1} rowSpan={2} />
              <PedigreeCard dog={pedigreeSireSireDam} relationship="Sire's Sire's Dam" column={3} rowStart={3} rowSpan={2} />
              <PedigreeCard dog={pedigreeSireDamSire} relationship="Sire's Dam's Sire" column={3} rowStart={5} rowSpan={2} />
              <PedigreeCard dog={pedigreeSireDamDam} relationship="Sire's Dam's Dam" column={3} rowStart={7} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamSireSire} relationship="Dam's Sire's Sire" column={3} rowStart={9} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamSireDam} relationship="Dam's Sire's Dam" column={3} rowStart={11} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamDamSire} relationship="Dam's Dam's Sire" column={3} rowStart={13} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamDamDam} relationship="Dam's Dam's Dam" column={3} rowStart={15} rowSpan={2} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireSire, "sireId")} relationship="Sire's Sire's Sire's Sire" column={4} rowStart={1} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireSire, "damId")} relationship="Sire's Sire's Sire's Dam" column={4} rowStart={2} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireDam, "sireId")} relationship="Sire's Sire's Dam's Sire" column={4} rowStart={3} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireDam, "damId")} relationship="Sire's Sire's Dam's Dam" column={4} rowStart={4} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamSire, "sireId")} relationship="Sire's Dam's Sire's Sire" column={4} rowStart={5} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamSire, "damId")} relationship="Sire's Dam's Sire's Dam" column={4} rowStart={6} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamDam, "sireId")} relationship="Sire's Dam's Dam's Sire" column={4} rowStart={7} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamDam, "damId")} relationship="Sire's Dam's Dam's Dam" column={4} rowStart={8} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireSire, "sireId")} relationship="Dam's Sire's Sire's Sire" column={4} rowStart={9} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireSire, "damId")} relationship="Dam's Sire's Sire's Dam" column={4} rowStart={10} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireDam, "sireId")} relationship="Dam's Sire's Dam's Sire" column={4} rowStart={11} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireDam, "damId")} relationship="Dam's Sire's Dam's Dam" column={4} rowStart={12} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamSire, "sireId")} relationship="Dam's Dam's Sire's Sire" column={4} rowStart={13} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamSire, "damId")} relationship="Dam's Dam's Sire's Dam" column={4} rowStart={14} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamDam, "sireId")} relationship="Dam's Dam's Dam's Sire" column={4} rowStart={15} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamDam, "damId")} relationship="Dam's Dam's Dam's Dam" column={4} rowStart={16} rowSpan={1} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-semibold text-white">Progeny</h2>

            {progeny.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {progeny.map((puppy) => (
                  <Link
                    key={puppy.id}
                    href={`/dogs/${puppy.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm transition hover:border-purple-300/35 hover:bg-white/10"
                  >
                    <span className="font-medium text-white">
                      {formatDogDisplayName(puppy)}
                    </span>
                    <span className="shrink-0 text-purple-100/70">
                      {puppy.sex}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/75">
                No progeny recorded.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-semibold text-white">Notes</h2>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-purple-100/75">
              {dog.notesPublic?.trim()
                ? dog.notesPublic
                : "Pedigree and advanced systems coming soon."}
            </div>

            {activeListing ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-purple-100/75">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Active Listing
                </div>
                <div className="mt-2 text-white">
                  {formatListingType(activeListing.listingType)} ·{" "}
                  {formatMoney(activeListing.askingPrice)}
                </div>
                {activeListing.descriptionPublic ? (
                  <div className="mt-2 text-purple-100/70">
                    {activeListing.descriptionPublic}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
