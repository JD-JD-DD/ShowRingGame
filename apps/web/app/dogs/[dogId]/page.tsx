import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
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
} from "@showring/rules";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import ManageDogStudListingForm from "@/components/dogs/ManageDogStudListingForm";
import OfferDogAtStudForm from "@/components/dogs/OfferDogAtStudForm";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import TraitLine from "@/components/ui/TraitLine";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";

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

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatTitledName(args: {
  name: string;
  prefix?: string | null;
  suffix?: string | null;
}) {
  return [args.prefix, args.name, args.suffix].filter(Boolean).join(" ");
}

function formatPlacement(finalRank: number | null): string {
  if (!finalRank) {
    return "Result";
  }

  if (finalRank === 1) return "1st";
  if (finalRank === 2) return "2nd";
  if (finalRank === 3) return "3rd";

  return `${finalRank}th`;
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
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
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
      sire: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
        },
      },
      dam: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
        },
      },
      sireOf: {
        orderBy: [{ birthEpoch: "desc" }, { regNumber: "asc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
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

  const ageHours = Math.max(0, currentEpoch - dog.birthEpoch);

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

  const canEnterShow =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= MIN_SHOW_AGE_HOURS &&
    ageHours <= MAX_SHOW_AGE_HOURS;

  const canBreed =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    (dog.sex === "M" ||
      (ageHours <= DAM_MAX_BREED_AGE_HOURS &&
        dog.breedingAttemptsAsDam.length === 0));

  const displayName =
    dog.registeredName || dog.callName || dog.regNumber || "Unnamed Dog";
  const titledDisplayName = formatTitledName({
    name: displayName,
    prefix: dog.visibleTitlePrefix,
    suffix: dog.visibleTitleSuffix,
  });
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
                {titledDisplayName}
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
                    .join(" • ")}
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

              {canEnterShow ? (
                <Link
                  href="/shows"
                  className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                >
                  Enter Show
                </Link>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-center text-sm font-semibold text-purple-100/45">
                  Enter Show
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
              dog.marketState === "NOT_FOR_SALE" &&
              !activeListing ? (
                <form action={`/api/dogs/${dog.id}/rehome`} method="post">
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 px-5 py-3 text-center text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                  >
                    Re-Home Dog
                  </button>
                </form>
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
              <h2 className="text-xl font-semibold text-white">
                Conditioning Snapshot
              </h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Ring Obedience
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.ringObedience}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Muscle Tone
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.muscleTone}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Coat Condition
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.coatCondition}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Fatigue
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {dog.fatiguePoints}
                  </div>
                </div>
              </div>
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
              <table className="w-full min-w-[840px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                    <th className="px-3 py-2">Show</th>
                    <th className="px-3 py-2">Breed</th>
                    <th className="px-3 py-2">Judge</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Awards</th>
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
                            {result.showDay.dayIndex} - District{" "}
                            {result.showDay.cluster.district}
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
                        <td className="px-3 py-3 text-purple-100/80">
                          <div className="font-semibold text-white">
                            {formatPlacement(result.finalRank)}
                          </div>
                          {result.placementCode ? (
                            <div className="text-xs text-purple-100/55">
                              {result.placementCode}
                            </div>
                          ) : null}
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

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-semibold text-white">Lineage</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Sire
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {dog.sire ? (
                    <Link href={`/dogs/${dog.sire.id}`} className="hover:underline">
                      {dog.sire.registeredName ??
                        dog.sire.callName ??
                        dog.sire.regNumber}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Dam
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {dog.dam ? (
                    <Link href={`/dogs/${dog.dam.id}`} className="hover:underline">
                      {dog.dam.registeredName ??
                        dog.dam.callName ??
                        dog.dam.regNumber}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </div>
              </div>
            </div>
          </section>

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
                      {puppy.registeredName ?? puppy.callName ?? puppy.regNumber}
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
