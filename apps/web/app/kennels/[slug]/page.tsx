import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getDistrictPanelStyle } from "@/lib/districtStyles";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import { getKennelPrestigeSummary } from "@/server/services/kennelPrestige.service";
import { getShowDistrictRegion } from "@showring/rules";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";

type PageProps = {
  params: Promise<{
    slug: string;
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

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

export default async function PublicKennelProfilePage({ params }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { slug } = await params;
  const currentEpoch = getCurrentEpoch();
  const kennel = await db.kennel.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      homeDistrict: true,
      publicSlogan: true,
    },
  });

  if (!kennel) {
    notFound();
  }

  const homeRegion = kennel.homeDistrict
    ? getShowDistrictRegion(kennel.homeDistrict)
    : null;
  const prestige = await getKennelPrestigeSummary(kennel.id);

  await resolveDogDeaths({ kennelId: kennel.id, currentEpoch });

  const [dogs, activeListings] = await Promise.all([
    db.dog.findMany({
      where: {
        ownerKennelId: kennel.id,
        lifecycleState: "ALIVE",
      },
      orderBy: [
        { breedCode2: "asc" },
        { registeredName: "asc" },
        { callName: "asc" },
        { regNumber: "asc" },
      ],
      select: {
        id: true,
        callName: true,
        registeredName: true,
        regNumber: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        breedCode2: true,
        sex: true,
        birthEpoch: true,
        marketState: true,
        breed: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.dogListing.findMany({
      where: {
        sellerKennelId: kennel.id,
        sellerType: "PLAYER",
        status: "ACTIVE",
        listingType: {
          in: [PLAYER_SALE_LISTING_TYPE, PLAYER_STUD_LISTING_TYPE],
        },
        dog: {
          lifecycleState: "ALIVE",
          ownerKennelId: kennel.id,
        },
      },
      orderBy: [{ listingType: "asc" }, { listedAtEpoch: "desc" }],
      select: {
        id: true,
        askingPrice: true,
        listingType: true,
        dog: {
          select: {
            id: true,
            callName: true,
            registeredName: true,
            regNumber: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
            breedCode2: true,
            sex: true,
            birthEpoch: true,
            breed: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const listingsByDogId = new Map(
    activeListings.map((listing) => [listing.dog.id, listing])
  );
  const studListings = activeListings.filter(
    (listing) => listing.listingType === PLAYER_STUD_LISTING_TYPE
  );
  const saleListings = activeListings.filter(
    (listing) => listing.listingType === PLAYER_SALE_LISTING_TYPE
  );

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">
                Public Kennel
              </p>
              <h1 className="mt-2 text-4xl font-semibold">{kennel.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
                {kennel.publicSlogan?.trim() ||
                  "Browse this kennel's active dogs, stud listings, and dogs for sale."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/bulletin"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Bulletin Board
              </Link>
              <Link
                href="/kennel"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                My Kennel
              </Link>
              <Link
                href="/kennels/top-ten"
                className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
              >
                Kennel Top Ten
              </Link>
              <Link
                href="/travel-map"
                className="rounded-2xl border border-sky-300/25 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
              >
                District Map
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Active Dogs
            </div>
            <div className="mt-2 text-3xl font-semibold">{dogs.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              At Stud
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {studListings.length}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              For Sale
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {saleListings.length}
            </div>
          </div>
          <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-5">
            <div className="text-xs uppercase tracking-wide text-fuchsia-100/80">
              Prestige
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {prestige.score.toLocaleString()}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-100/70">
              {prestige.tier.label}
            </div>
          </div>
          <div
            style={homeRegion ? getDistrictPanelStyle(homeRegion) : undefined}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Region
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {homeRegion?.name ?? "-"}
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <ListingPanel
            title="Dogs At Stud"
            listings={studListings}
            currentEpoch={currentEpoch}
          />
          <ListingPanel
            title="Dogs For Sale"
            listings={saleListings}
            currentEpoch={currentEpoch}
          />
        </section>

        <section className="overflow-hidden rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem_5rem_5rem_8rem] gap-4 border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200/85">
            <div>Dog</div>
            <div>Breed</div>
            <div>Sex</div>
            <div>Age</div>
            <div className="text-right">Status</div>
          </div>

          {dogs.length === 0 ? (
            <div className="px-5 py-5 text-sm text-purple-100/70">
              No active dogs are visible for this kennel.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {dogs.map((dog) => {
                const listing = listingsByDogId.get(dog.id);
                const status =
                  listing?.listingType === PLAYER_STUD_LISTING_TYPE
                    ? "At Stud"
                    : listing?.listingType === PLAYER_SALE_LISTING_TYPE
                      ? "For Sale"
                      : "";

                return (
                  <Link
                    key={dog.id}
                    href={`/dogs/${dog.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_7rem_5rem_5rem_8rem] gap-4 px-5 py-2.5 text-sm transition hover:bg-white/5"
                  >
                    <div className="min-w-0 truncate font-semibold text-white">
                      {formatDogDisplayName(dog)}
                    </div>
                    <div className="truncate text-purple-100/75">
                      {dog.breed.name} ({dog.breedCode2})
                    </div>
                    <div className="text-purple-100/75">{dog.sex}</div>
                    <div className="text-purple-100/75">
                      {formatAge(Math.max(0, currentEpoch - dog.birthEpoch))}
                    </div>
                    <div className="text-right text-purple-100/75">
                      {status || "-"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ListingPanel({
  title,
  listings,
  currentEpoch,
}: {
  title: string;
  currentEpoch: number;
  listings: Array<{
    id: string;
    askingPrice: number;
    dog: {
      id: string;
      callName: string | null;
      registeredName: string | null;
      regNumber: string;
      visibleTitlePrefix: string | null;
      visibleTitleSuffix: string | null;
      breedCode2: string;
      sex: "M" | "F";
      birthEpoch: number;
      breed: {
        name: string;
      };
    };
  }>;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {listings.length === 0 ? (
        <p className="mt-4 text-sm text-purple-100/70">None right now.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/dogs/${listing.dog.id}`}
              className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm transition hover:bg-white/5"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">
                  {formatDogDisplayName(listing.dog)}
                </div>
                <div className="mt-1 text-xs text-purple-100/55">
                  {listing.dog.breed.name} ({listing.dog.breedCode2}) -{" "}
                  {listing.dog.sex} -{" "}
                  {formatAge(Math.max(0, currentEpoch - listing.dog.birthEpoch))}
                </div>
              </div>
              <div className="self-center text-right font-semibold text-purple-100">
                {formatMoney(listing.askingPrice)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
