import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";
import TraitLine from "@/components/ui/TraitLine";
import {
  CURRENT_BREED_RELEASE,
  MIN_BREED_AGE_HOURS,
  deriveVisibleCategoriesFromTraits,
} from "@showring/rules";

type PageProps = {
  searchParams?: Promise<{
    breedCode2?: string | string[];
  }>;
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

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
  const selectedBreedCode2 =
    firstQueryValue(resolvedSearchParams.breedCode2)?.trim().toUpperCase() ?? "";
  const currentEpoch = getCurrentEpoch();

  const breeds = await db.breed.findMany({
    where: {
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

  const listings = await db.dogListing.findMany({
    where: {
      sellerType: "PLAYER",
      listingType: PLAYER_STUD_LISTING_TYPE,
      status: "ACTIVE",
      sellerKennelId: {
        not: kennel.id,
      },
      dog: {
        ...(selectedBreedCode2 ? { breedCode2: selectedBreedCode2 } : {}),
        lifecycleState: "ALIVE",
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
    select: {
      id: true,
      askingPrice: true,
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
        },
      },
    },
  });

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-sky-200/85">
                Public Studs
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
                Browse Dogs At Stud
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
                Find eligible male dogs offered by other kennels, compare visible
                trait categories, and start a breeding with a selected public stud.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/breed"
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                Plan A Litter
              </Link>
              <Link
                href="/kennel"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                My Kennel
              </Link>
            </div>
          </div>

          <div className="mt-5 inline-flex rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-2 text-sm text-purple-100/80">
            {kennel.name} balance: {formatMoney(kennel.balance)}
          </div>
        </section>

        <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <form className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label
                htmlFor="breedCode2"
                className="mb-1 block text-xs uppercase tracking-wide text-purple-100/60"
              >
                Breed
              </label>
              <select
                id="breedCode2"
                name="breedCode2"
                defaultValue={selectedBreedCode2}
                className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">All breeds</option>
                {breeds.map((breed) => (
                  <option key={breed.code2} value={breed.code2}>
                    {breed.name}
                    {breed.groupName ? ` - ${breed.groupName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              Filter
            </button>

            <Link
              href="/studs"
              className="rounded-xl border border-purple-300/25 bg-white/5 px-5 py-2.5 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Clear
            </Link>
          </form>
        </section>

        {listings.length === 0 ? (
          <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            No public studs match the current filter.
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => {
              const dog = listing.dog;
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

              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-[24px] border border-sky-300/25 bg-[linear-gradient(180deg,rgba(13,43,62,0.94),rgba(20,13,35,0.98))] shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
                >
                  <div className="border-b border-sky-200/10 bg-sky-500/10 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-sky-100">
                          {dog.breed.name}{" "}
                          <span className="text-purple-100/60">
                            ({dog.breedCode2})
                          </span>
                        </div>
                        <h2 className="mt-2 text-2xl font-bold text-white">
                          {formatDogDisplayName(dog)}
                        </h2>
                        <div className="mt-2 text-sm text-purple-100/70">
                          {dog.regNumber}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-2 text-right">
                        <div className="text-xs uppercase tracking-wide text-sky-100/80">
                          Stud Fee
                        </div>
                        <div className="mt-1 text-xl font-bold text-white">
                          {formatMoney(listing.askingPrice)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-purple-200">
                          Owner
                        </div>
                        <div className="mt-1 font-medium text-white">
                          {dog.ownerKennel?.name ?? "Player Kennel"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-purple-200">
                          Age
                        </div>
                        <div className="mt-1 font-medium text-white">
                          {ageLabel(Math.max(0, currentEpoch - dog.birthEpoch))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-100/80">
                        Visible Categories
                      </h3>

                      <div className="space-y-3">
                        {Object.entries(visibleCategories).map(([key, value]) => (
                          <TraitLine
                            key={key}
                            label={formatCategoryName(key)}
                            value={value}
                            min={0}
                            max={20}
                            ideal={10}
                            leftLabel="0"
                            rightLabel="20"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex items-stretch gap-3">
                      <Link
                        href={`/breed?studListingId=${listing.id}`}
                        className="flex-1 rounded-2xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
                      >
                        Use At Stud
                      </Link>

                      <Link
                        href={`/dogs/${dog.id}`}
                        className="flex-1 rounded-2xl border border-purple-300/25 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
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
