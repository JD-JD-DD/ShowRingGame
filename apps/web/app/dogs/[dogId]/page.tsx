import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { deriveVisibleCategoriesFromTraits } from "@showring/rules";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
} from "@showring/rules";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import TraitLine from "@/components/ui/TraitLine";

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

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
      listings: {
        where: {
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
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
  const activeListing = dog.listings[0] ?? null;
  const isAlive = dog.lifecycleState === "ALIVE";
  const isListedForSale =
    !!activeListing &&
    (dog.marketState === "LISTED_NPC" || dog.marketState === "LISTED_PLAYER");
  const canBuyActiveListing =
    isListedForSale && isAlive && !isOwnedByCurrentKennel;

  const canEnterShow =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= MIN_SHOW_AGE_HOURS &&
    ageHours <= MAX_SHOW_AGE_HOURS;

  const canBreed =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    (dog.sex === "M" || ageHours <= DAM_MAX_BREED_AGE_HOURS);

  const displayName =
    dog.registeredName || dog.callName || dog.regNumber || "Unnamed Dog";
  const canNameDog = isOwnedByCurrentKennel && !dog.registeredName?.trim();
  const canOfferForSale =
    isOwnedByCurrentKennel &&
    isAlive &&
    dog.marketState === "NOT_FOR_SALE";

  const categoryEntries = Object.entries(visibleCategories);

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

              {canBuyActiveListing && activeListing ? (
                <form
                  action={`/api/market-dogs/${activeListing.id}/buy`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Buy for {formatMoney(activeListing.askingPrice)}
                  </button>
                </form>
              ) : null}

              {canOfferForSale ? (
                <OfferDogForSaleForm
                  action={`/api/dogs/${dog.id}/list-for-sale`}
                />
              ) : isOwnedByCurrentKennel && activeListing ? (
                <ManageDogListingForm
                  dogId={dog.id}
                  listingId={activeListing.id}
                  currentPrice={activeListing.askingPrice}
                  updateAction={`/api/market-dogs/${activeListing.id}/update-price`}
                  cancelAction={`/api/market-dogs/${activeListing.id}/cancel`}
                />
              ) : null}

              {isOwnedByCurrentKennel && isAlive && dog.marketState === "NOT_FOR_SALE" ? (
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

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Show Eligibility
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {ageHours >= MIN_SHOW_AGE_HOURS && ageHours <= MAX_SHOW_AGE_HOURS
                      ? "Eligible"
                      : "Not eligible"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Breeding Eligibility
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {ageHours >= MIN_BREED_AGE_HOURS &&
                    (dog.sex === "M" || ageHours <= DAM_MAX_BREED_AGE_HOURS)
                      ? "Eligible"
                      : "Not eligible"}
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
                  {activeListing.listingType} · {formatMoney(activeListing.askingPrice)}
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
