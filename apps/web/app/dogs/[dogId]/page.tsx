import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CancelGroomingListingForm from "@/components/dogs/CancelGroomingListingForm";
import DogProfileKennelRunMove from "@/components/dogs/DogProfileKennelRunMove";
import DogProfileDashboard from "@/components/dogs/DogProfileDashboard";
import HealthClearBadge from "@/components/dogs/HealthClearBadge";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import ManageDogStudListingForm from "@/components/dogs/ManageDogStudListingForm";
import OfferDogAtStudForm from "@/components/dogs/OfferDogAtStudForm";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import RehomeDogForm from "@/components/dogs/RehomeDogForm";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getDogProfile } from "@/server/services/dog.service";
import { getKennelForUser } from "@/server/services/kennel.service";

type DogSearchParams = {
    nameError?: string | string[];
    saleError?: string | string[];
    saleMessage?: string | string[];
    error?: string | string[];
    message?: string | string[];
    healthError?: string | string[];
    healthMessage?: string | string[];
    notesError?: string | string[];
    notesMessage?: string | string[];
    showError?: string | string[];
    showMessage?: string | string[];
};

type PageProps = {
  params: Promise<{ dogId: string }>;
  searchParams?: Promise<DogSearchParams>;
};

type RosterNavigationDog = {
  id: string;
  displayName: string;
  regNumber: string;
  breedCode2: string;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getRosterDogDisplayName(dog: {
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
}): string {
  return (
    dog.callName?.trim() ||
    dog.registeredName?.trim() ||
    dog.regNumber ||
    "Unnamed Dog"
  );
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatCondition(value: number): string {
  return value.toFixed(2);
}

function formatSignedCondition(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function badgeClass(tone: string): string {
  switch (tone) {
    case "green":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "yellow":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "red":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    case "blue":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    default:
      return "border-[var(--dog-border)] bg-purple-500/10 text-[var(--dog-heading)]";
  }
}

function statusMessage(message: string | null, isError = false) {
  if (!message) return null;

  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
        isError
          ? "border-red-300/20 bg-red-500/10 text-red-100"
          : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      }`}
    >
      {message}
    </div>
  );
}

export default async function DogPage({ params, searchParams }: PageProps) {
  const [{ dogId }, userId] = await Promise.all([
    params,
    getSessionUserId(),
  ]);
  const resolvedSearchParams: DogSearchParams = searchParams
    ? await searchParams
    : {};

  if (!userId) redirect("/login");

  const currentKennel = await getKennelForUser(userId);
  if (!currentKennel) redirect("/onboarding");

  const currentEpoch = getCurrentEpoch();
  const profile = await getDogProfile({
    dogId,
    viewerKennelId: currentKennel.id,
    currentEpoch,
  });

  if (!profile) notFound();

  const currentDogKennelRunId = profile.currentRun?.runId ?? null;
  const ownedDogRoster = profile.viewerContext.isOwnedByCurrentKennel
    ? await db.dog.findMany({
        where: {
          ownerKennelId: currentKennel.id,
          kennelRunId: currentDogKennelRunId,
          lifecycleState: "ALIVE",
          isPlayerVisible: true,
        },
        orderBy: [{ birthEpoch: "desc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          breedCode2: true,
          birthEpoch: true,
        },
      })
    : [];
  const currentRosterIndex = ownedDogRoster.findIndex(
    (rosterDog) => rosterDog.id === profile.header.dogId
  );
  const toRosterNavigationDog = (
    rosterDog: (typeof ownedDogRoster)[number]
  ): RosterNavigationDog => ({
    id: rosterDog.id,
    displayName: getRosterDogDisplayName(rosterDog),
    regNumber: rosterDog.regNumber,
    breedCode2: rosterDog.breedCode2,
  });
  const dogRosterNavigation =
    profile.viewerContext.isOwnedByCurrentKennel &&
    ownedDogRoster.length > 1 &&
    currentRosterIndex >= 0
      ? {
          previousDog:
            currentRosterIndex > 0
              ? toRosterNavigationDog(ownedDogRoster[currentRosterIndex - 1])
              : null,
          nextDog:
            currentRosterIndex < ownedDogRoster.length - 1
              ? toRosterNavigationDog(ownedDogRoster[currentRosterIndex + 1])
              : null,
          currentIndex: currentRosterIndex,
          totalDogs: ownedDogRoster.length,
        }
      : null;

  const nameError = firstQueryValue(resolvedSearchParams.nameError);
  const saleError = firstQueryValue(resolvedSearchParams.saleError);
  const saleMessage = firstQueryValue(resolvedSearchParams.saleMessage);
  const groomingError = firstQueryValue(resolvedSearchParams.error);
  const groomingMessage = firstQueryValue(resolvedSearchParams.message);
  const healthError = firstQueryValue(resolvedSearchParams.healthError);
  const healthMessage = firstQueryValue(resolvedSearchParams.healthMessage);
  const notesError = firstQueryValue(resolvedSearchParams.notesError);
  const notesMessage = firstQueryValue(resolvedSearchParams.notesMessage);
  const showError = firstQueryValue(resolvedSearchParams.showError);
  const showMessage = firstQueryValue(resolvedSearchParams.showMessage);
  const { header, actions, viewerContext } = profile;
  const canMoveKennelRun =
    viewerContext.isOwnedByCurrentKennel && header.lifecycleState === "ALIVE";
  const canEnterShow =
    viewerContext.isOwnedByCurrentKennel &&
    header.lifecycleState === "ALIVE" &&
    profile.snapshot.canShow;
  const saleListing = profile.breedingAndProduction.activeSaleListing;
  const studListing = profile.breedingAndProduction.activeStudListing;
  const grooming = profile.groomingDetails;
  const dogPageReturnTo = `/dogs/${header.dogId}`;
  const headerDisplayName = [
    header.visibleTitlePrefix,
    header.registeredName ?? header.callName ?? header.displayName,
    header.visibleTitleSuffix,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="dog-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="dog-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_540px]">
            <div className="max-w-4xl">
              <div className="mb-3 inline-flex rounded-full border border-[var(--dog-border)] bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
                Show Profile
              </div>
              <div className="text-sm font-medium text-[var(--dog-label)]">
                {header.breedName}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="dog-heading text-4xl font-bold tracking-tight sm:text-5xl">
                  {headerDisplayName}
                </h1>
                {profile.snapshot.healthTestingSummary.badgeStatus ? (
                  <HealthClearBadge
                    status={profile.snapshot.healthTestingSummary.badgeStatus}
                    fullClearance={profile.snapshot.healthTestingSummary.hasFullClearance}
                    size="lg"
                  />
                ) : null}
              </div>

              {actions.canName ? (
                <RegisterDogNameForm
                  action={`/api/dogs/${header.dogId}/rename`}
                  nameError={nameError}
                />
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {header.badges.map((badge) =>
                  badge.href ? (
                    <Link
                      key={badge.code}
                      href={badge.href}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:brightness-110 ${badgeClass(badge.tone)}`}
                    >
                      {badge.label}
                    </Link>
                  ) : (
                    <span
                      key={badge.code}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(badge.tone)}`}
                    >
                      {badge.label}
                    </span>
                  )
                )}
              </div>

              {dogRosterNavigation ? (
                <nav
                  aria-label="Kennel run dog navigation"
                  className="mt-4 max-w-3xl rounded-2xl border border-purple-300/25 bg-white/5 p-2"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                    {dogRosterNavigation.previousDog ? (
                      <Link
                        href={`/dogs/${dogRosterNavigation.previousDog.id}`}
                        className="flex min-h-12 flex-col justify-center rounded-xl border border-purple-300/25 bg-white/5 px-3 py-2 text-sm font-semibold text-purple-50 transition hover:bg-white/10"
                      >
                        <span>&larr; Previous Dog</span>
                        <span className="mt-0.5 truncate text-xs font-medium text-purple-100/70">
                          Previous: {dogRosterNavigation.previousDog.displayName}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex min-h-12 flex-col justify-center rounded-xl border border-purple-300/10 bg-black/20 px-3 py-2 text-sm font-semibold text-purple-100/40">
                        <span>&larr; Previous Dog</span>
                        <span className="mt-0.5 text-xs font-medium">
                          Previous: None
                        </span>
                      </span>
                    )}

                    <div className="flex min-h-12 items-center justify-center rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-purple-100/75">
                      Dog {dogRosterNavigation.currentIndex + 1} of{" "}
                      {dogRosterNavigation.totalDogs}
                    </div>

                    {dogRosterNavigation.nextDog ? (
                      <Link
                        href={`/dogs/${dogRosterNavigation.nextDog.id}`}
                        className="flex min-h-12 flex-col justify-center rounded-xl border border-purple-300/25 bg-white/5 px-3 py-2 text-left text-sm font-semibold text-purple-50 transition hover:bg-white/10 sm:text-right"
                      >
                        <span>Next Dog &rarr;</span>
                        <span className="mt-0.5 truncate text-xs font-medium text-purple-100/70">
                          Next: {dogRosterNavigation.nextDog.displayName}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex min-h-12 flex-col justify-center rounded-xl border border-purple-300/10 bg-black/20 px-3 py-2 text-left text-sm font-semibold text-purple-100/40 sm:text-right">
                        <span>Next Dog &rarr;</span>
                        <span className="mt-0.5 text-xs font-medium">
                          Next: None
                        </span>
                      </span>
                    )}
                  </div>
                </nav>
              ) : null}

              {statusMessage(saleMessage)}
              {statusMessage(saleError, true)}
              {statusMessage(groomingMessage)}
              {statusMessage(groomingError, true)}
            </div>

            <div className="flex flex-col gap-4 lg:justify-self-end">
              <div className="grid gap-3 sm:grid-cols-2">
                {actions.canBreed ? (
                  <Link
                    href={`/breed?dogId=${header.dogId}`}
                    className="rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500"
                  >
                    Breed Dog
                  </Link>
                ) : (
                  <div className="dog-card dog-copy rounded-2xl px-5 py-3 text-center text-sm font-semibold opacity-60">
                    Breed Dog
                  </div>
                )}

                {canEnterShow ? (
                  <Link
                    href={`/dogs/${header.dogId}/show-entry`}
                    className="rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500"
                  >
                    Show Entry
                  </Link>
                ) : (
                  <div className="dog-card dog-copy rounded-2xl px-5 py-3 text-center text-sm font-semibold opacity-60">
                    Show Entry
                  </div>
                )}

                {viewerContext.canManage && grooming ? (
                  <details className="group">
                    <summary className="list-none rounded-2xl bg-amber-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-amber-500 [&::-webkit-details-marker]:hidden">
                      Groom Dog
                    </summary>
                    <div className="dog-card mt-3 rounded-2xl p-4">
                      <div className="dog-heading text-sm font-semibold">
                        Grooming
                      </div>
                      <div className="dog-copy mt-3 grid gap-2 text-sm">
                        <div>
                          Actions remaining: {grooming.weeklyActionsRemaining} /{" "}
                          {grooming.weeklyActionLimit}
                        </div>
                        <div>
                          Coat condition:{" "}
                          {formatCondition(grooming.currentCoatCondition)}
                        </div>
                        <div>
                          Net effect: {formatSignedCondition(grooming.netGroomingEffect)}
                        </div>
                        <div>Status: {grooming.groomingStatus}</div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {grooming.canCancelOutsideGrooming &&
                        grooming.outsideGroomingListingId ? (
                          <CancelGroomingListingForm
                            action={`/api/services/grooming/listings/${grooming.outsideGroomingListingId}/cancel`}
                            dogName={header.displayName}
                          />
                        ) : (
                          <>
                            <form action="/api/services/grooming/self-groom" method="post">
                              <input type="hidden" name="dogId" value={header.dogId} />
                              <input type="hidden" name="returnTo" value={dogPageReturnTo} />
                              <button
                                type="submit"
                                disabled={!grooming.canGroom}
                                className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                Confirm Groom Dog
                              </button>
                            </form>
                            <form action="/api/services/grooming/list" method="post">
                              <input type="hidden" name="dogId" value={header.dogId} />
                              <input type="hidden" name="returnTo" value={dogPageReturnTo} />
                              <ConfirmSubmitButton
                                message={`Offer ${header.displayName} for outside grooming?`}
                                disabled={!grooming.canOfferOutsideGrooming}
                                className="w-full rounded-xl border border-sky-300/25 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                Offer for Outside Grooming
                              </ConfirmSubmitButton>
                            </form>
                          </>
                        )}
                      </div>
                    </div>
                  </details>
                ) : null}

                {actions.canOfferForSale ? (
                  <OfferDogForSaleForm
                    action={`/api/dogs/${header.dogId}/list-for-sale`}
                  />
                ) : (actions.canEditSaleListing ||
                    actions.canCancelSaleListing) && saleListing ? (
                  <ManageDogListingForm
                    dogId={header.dogId}
                    listingId={saleListing.listingId}
                    currentPrice={saleListing.askingPrice}
                    updateAction={`/api/market-dogs/${saleListing.listingId}/update-price`}
                    cancelAction={`/api/market-dogs/${saleListing.listingId}/cancel`}
                  />
                ) : null}

                <button
                  type="button"
                  disabled
                  className="dog-secondary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold opacity-60"
                >
                  Move Run
                </button>

                {actions.canRehome && actions.rehomePayout !== null ? (
                  <RehomeDogForm
                    action={`/api/dogs/${header.dogId}/rehome`}
                    dogName={header.displayName}
                    payout={actions.rehomePayout}
                  />
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {actions.canBuyActiveListing && saleListing ? (
                  <form
                    action={`/api/market-dogs/${saleListing.listingId}/buy`}
                    method="post"
                  >
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Buy for {formatMoney(saleListing.askingPrice)}
                    </button>
                  </form>
                ) : null}

                {actions.canUseActiveStudListing && studListing ? (
                  <Link
                    href={`/breed?studListingId=${studListing.listingId}`}
                    className="rounded-2xl bg-sky-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
                  >
                    Use At Stud for {formatMoney(studListing.studFee)}
                  </Link>
                ) : null}

                {actions.canOfferAtStud ? (
                  <OfferDogAtStudForm
                    action={`/api/dogs/${header.dogId}/list-at-stud`}
                  />
                ) : (actions.canEditStudFee ||
                    actions.canCancelStudListing) && studListing ? (
                  <ManageDogStudListingForm
                    dogId={header.dogId}
                    listingId={studListing.listingId}
                    currentPrice={studListing.studFee}
                    updateAction={`/api/stud-listings/${studListing.listingId}/update-price`}
                    cancelAction={`/api/stud-listings/${studListing.listingId}/cancel`}
                  />
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DogProfileKennelRunMove
                  dogId={header.dogId}
                  currentRunId={profile.currentRun?.runId ?? null}
                  currentRunName={profile.currentRun?.name ?? null}
                  canMove={canMoveKennelRun}
                />
              </div>
            </div>

          </div>
        </section>

        <DogProfileDashboard
          profile={profile}
          currentEpoch={currentEpoch}
          healthMessage={healthMessage}
          healthError={healthError}
          notesMessage={notesMessage}
          notesError={notesError}
          showMessage={showMessage}
          showError={showError}
        />
      </div>
    </main>
  );
}
