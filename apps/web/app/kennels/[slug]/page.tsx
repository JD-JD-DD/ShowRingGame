import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getDistrictPanelStyle } from "@/lib/districtStyles";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getSupporterBadgePresentation } from "@/lib/supporterBadgePresentation";
import SupporterBadge from "@/components/support/SupporterBadge";
import { getCanonicalSupportSubscription } from "@/server/services/supportSubscription.service";
import { getKennelPrestigeSummary } from "@/server/services/kennelPrestige.service";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  getKennelMessagingBlockState,
  isMessageableKennel,
} from "@/server/services/kennelMessaging.service";
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
  const [kennel, currentKennel] = await Promise.all([
    db.kennel.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      userId: true,
      isNpc: true,
      homeDistrict: true,
      publicSlogan: true,
      moderationStatus: true,
      showSupporterBadge: true,
      user: {
        select: {
          moderationStatus: true,
        },
      },
      renameHistory: {
        orderBy: {
          changedAt: "desc",
        },
        take: 1,
        select: {
          previousName: true,
        },
      },
    },
    }),
    getKennelForUser(userId),
  ]);

  if (!kennel || kennel.moderationStatus === "CLOSED") {
    const renamedKennel = await db.kennelRenameHistory.findFirst({
      where: {
        previousSlug: slug,
      },
      orderBy: {
        changedAt: "desc",
      },
      select: {
        kennel: {
          select: {
            slug: true,
          },
        },
      },
    });

    if (renamedKennel) {
      permanentRedirect(`/kennels/${renamedKennel.kennel.slug}`);
    }

    notFound();
  }

  const homeRegion = kennel.homeDistrict
    ? getShowDistrictRegion(kennel.homeDistrict)
    : null;
  const prestige = await getKennelPrestigeSummary(kennel.id);
  const isPotentialMessagingPair = Boolean(
    currentKennel &&
    currentKennel.id !== kennel.id &&
    isMessageableKennel(kennel)
  );
  const blockState = isPotentialMessagingPair && currentKennel
    ? await getKennelMessagingBlockState({
      requestingKennelId: currentKennel.id,
      otherKennelId: kennel.id,
    })
    : null;
  const canMessageKennel = isPotentialMessagingPair && !blockState?.isBlocked;

  const [dogs, activeListings] = await Promise.all([
    db.dog.findMany({
      where: {
        ownerKennelId: kennel.id,
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
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
          isPlayerVisible: true,
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
  const support = kennel.userId
    ? await getCanonicalSupportSubscription({ userId: kennel.userId })
    : null;
  const supporterBadge = getSupporterBadgePresentation({ tier: support?.currentTier, status: support?.status, currentPaidPeriodEnd: support?.currentPaidPeriodEnd, showSupporterBadge: kennel.showSupporterBadge });
  const saleListings = activeListings.filter(
    (listing) => listing.listingType === PLAYER_SALE_LISTING_TYPE
  );

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="theme-label text-sm uppercase tracking-[0.25em]">
                Public Kennel
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="theme-heading text-4xl font-semibold">{kennel.name}</h1>{supporterBadge.visible ? <SupporterBadge tier={supporterBadge.tier} /> : null}</div>
              {kennel.renameHistory[0]?.previousName ? (
                <p className="theme-copy mt-2 text-sm">
                  Previously known as: {kennel.renameHistory[0].previousName}
                </p>
              ) : null}
              <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
                {kennel.publicSlogan?.trim() ||
                  "Browse this kennel's active dogs, stud listings, and dogs for sale."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {canMessageKennel ? (
                <Link
                  href={`/inbox/messages/start/${kennel.slug}`}
                  className="theme-primary-button rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Message Kennel
                </Link>
              ) : null}
              <Link
                href="/community"
                className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Community
              </Link>
              <Link
                href="/kennel"
                className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                My Kennel
              </Link>
              <Link
                href="/kennels/top-ten"
                className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Kennel Top Ten
              </Link>
              <Link
                href="/travel-map"
                className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                District Map
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="theme-card p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
              Active Dogs
            </div>
            <div className="mt-2 text-3xl font-semibold">{dogs.length}</div>
          </div>
          <div className="theme-card p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
              At Stud
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {studListings.length}
            </div>
          </div>
          <div className="theme-card p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
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
            className="theme-card p-5"
          >
            <div className="theme-label text-xs uppercase tracking-wide">
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

        <section className="theme-panel overflow-hidden rounded-[28px]">
          <div className="theme-label grid grid-cols-[minmax(0,1fr)_7rem_5rem_5rem_8rem] gap-4 border-b border-[var(--color-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em]">
            <div>Dog</div>
            <div>Breed</div>
            <div>Sex</div>
            <div>Age</div>
            <div className="text-right">Status</div>
          </div>

          {dogs.length === 0 ? (
            <div className="theme-copy px-5 py-5 text-sm">
              No active dogs are visible for this kennel.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
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
                    className="grid grid-cols-[minmax(0,1fr)_7rem_5rem_5rem_8rem] gap-4 px-5 py-2.5 text-sm transition hover:bg-[var(--color-surface-subtle)]"
                  >
                    <div className="theme-heading min-w-0 truncate font-semibold">
                      {formatDogDisplayName(dog)}
                    </div>
                    <div className="theme-copy truncate">
                      {dog.breed.name} ({dog.breedCode2})
                    </div>
                    <div className="theme-copy">{dog.sex}</div>
                    <div className="theme-copy">
                      {formatAge(Math.max(0, currentEpoch - dog.birthEpoch))}
                    </div>
                    <div className="theme-copy text-right">
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
    <div className="theme-panel rounded-[24px] p-5">
      <h2 className="theme-heading text-xl font-semibold">{title}</h2>
      {listings.length === 0 ? (
        <p className="theme-copy mt-4 text-sm">None right now.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/dogs/${listing.dog.id}`}
              className="theme-card-interactive grid grid-cols-[minmax(0,1fr)_6rem] gap-3 rounded-2xl px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="theme-heading truncate font-semibold">
                  {formatDogDisplayName(listing.dog)}
                </div>
                <div className="theme-copy mt-1 text-xs">
                  {listing.dog.breed.name} ({listing.dog.breedCode2}) -{" "}
                  {listing.dog.sex} -{" "}
                  {formatAge(Math.max(0, currentEpoch - listing.dog.birthEpoch))}
                </div>
              </div>
              <div className="theme-heading self-center text-right font-semibold">
                {formatMoney(listing.askingPrice)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
