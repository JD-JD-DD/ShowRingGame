import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CancelGroomingListingForm from "@/components/dogs/CancelGroomingListingForm";
import BreedDogActionButton from "@/components/dogs/BreedDogActionButton";
import DogProfileKennelRunMove from "@/components/dogs/DogProfileKennelRunMove";
import DogProfileDashboard from "@/components/dogs/DogProfileDashboard";
import DogStatusBadges from "@/components/dogs/DogStatusBadges";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import ManageDogStudListingForm from "@/components/dogs/ManageDogStudListingForm";
import OfferDogAtStudForm from "@/components/dogs/OfferDogAtStudForm";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import RehomeDogForm from "@/components/dogs/RehomeDogForm";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
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
    kennelRunId?: string | string[];
    from?: string | string[];
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
      return "theme-status-success";
    case "yellow":
      return "theme-status-warning";
    case "red":
      return "theme-status-danger";
    case "blue":
      return "theme-status-info";
    default:
      return "theme-neutral-badge";
  }
}

function statusMessage(message: string | null, isError = false) {
  if (!message) return null;

  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
        isError
          ? "theme-notice theme-notice--danger"
          : "theme-notice theme-notice--success"
      }`}
    >
      {message}
    </div>
  );
}

export default async function DogPage({ params, searchParams }: PageProps) {
  const perf = createPerfTimer({ route: "/dogs/[dogId]" });
  const [{ dogId }, userId] = await perf.measure("paramsAndSessionMs", () =>
    Promise.all([params, getSessionUserId()])
  );
  const resolvedSearchParams: DogSearchParams = searchParams
    ? await searchParams
    : {};

  if (!userId) redirect("/login");

  const currentKennel = await perf.measure("kennelLookupMs", () =>
    getKennelForUser(userId)
  );
  if (!currentKennel) redirect("/onboarding");

  const currentEpoch = getCurrentEpoch();
  const profile = await perf.measure("dogProfileMs", () =>
    getDogProfile({
      dogId,
      viewerKennelId: currentKennel.id,
      currentEpoch,
    })
  );

  if (!profile) notFound();

  const requestedKennelRunId = firstQueryValue(resolvedSearchParams.kennelRunId);
  const validatedKennelRunId =
    requestedKennelRunId &&
    profile.viewerContext.isOwnedByCurrentKennel &&
    profile.currentRun?.runId === requestedKennelRunId
      ? requestedKennelRunId
      : null;
  const ownedDogRoster = validatedKennelRunId
    ? await perf.measure("ownedRosterMs", () =>
        db.dog.findMany({
          where: {
            ownerKennelId: currentKennel.id,
            kennelRunId: validatedKennelRunId,
            lifecycleState: "ALIVE",
            isPlayerVisible: true,
          },
          orderBy: [{ birthEpoch: "asc" }, { regNumber: "asc" }],
          select: {
            id: true,
            callName: true,
            registeredName: true,
            regNumber: true,
            breedCode2: true,
            birthEpoch: true,
          },
        })
      )
    : [];
  const currentRosterIndex = ownedDogRoster.findIndex(
    (rosterDog) => rosterDog.id === profile.header.dogId
  );
  const navigationKennelRunId =
    validatedKennelRunId && currentRosterIndex >= 0
      ? validatedKennelRunId
      : null;
  const toRosterNavigationDog = (
    rosterDog: (typeof ownedDogRoster)[number]
  ): RosterNavigationDog => ({
    id: rosterDog.id,
    displayName: getRosterDogDisplayName(rosterDog),
    regNumber: rosterDog.regNumber,
    breedCode2: rosterDog.breedCode2,
  });
  const dogRosterNavigation =
    navigationKennelRunId &&
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
          kennelRunId: navigationKennelRunId,
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
  const openedFromMarket = firstQueryValue(resolvedSearchParams.from) === "market";
  const { header, actions, viewerContext } = profile;
  const canMoveKennelRun =
    viewerContext.isOwnedByCurrentKennel && header.lifecycleState === "ALIVE";
  const canEnterShow =
    viewerContext.isOwnedByCurrentKennel &&
    header.lifecycleState === "ALIVE" &&
    profile.snapshot.canShow;
  const saleListing = profile.breedingAndProduction.activeSaleListing;
  const studListing = profile.breedingAndProduction.activeStudListing;
  const marketSaleListing =
    openedFromMarket && actions.canBuyActiveListing && saleListing
      ? saleListing
      : null;
  const grooming = profile.groomingDetails;
  const dogPageMutationContext = navigationKennelRunId
    ? `?kennelRunId=${encodeURIComponent(navigationKennelRunId)}`
    : "";
  const dogPageReturnTo = `/dogs/${header.dogId}${navigationKennelRunId ? `?kennelRunId=${encodeURIComponent(navigationKennelRunId)}` : ""}`;
  const headerDisplayName = [
    header.visibleTitlePrefix,
    header.registeredName ?? header.callName ?? header.displayName,
    header.visibleTitleSuffix,
  ]
    .filter(Boolean)
    .join(" ");
  perf.log({
    userContextPresent: true,
    kennelContextPresent: true,
    isOwnedDog: profile.viewerContext.isOwnedByCurrentKennel,
    rosterCount: ownedDogRoster.length,
    recentResultCount: profile.titlesAndShowCareer.recentShowResults.length,
    upcomingEntryCount: profile.entries?.nextEntries.length ?? 0,
    pedigreeAncestorCount: profile.pedigree.ancestors.length,
    visibleCategoryCount: profile.qualityAndPresentation.visibleCategories.length,
    payloadSizeBytes: estimateJsonSizeBytes({ profile, ownedDogRoster }),
  });

  return (
    <main className="dog-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="dog-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_540px]">
            <div className="max-w-4xl">
              <div className="theme-neutral-badge mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
                Show Profile
              </div>
              <div className="text-sm font-medium text-[var(--dog-label)]">
                {header.breedName}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="dog-heading text-4xl font-bold tracking-tight sm:text-5xl">
                  {headerDisplayName}
                </h1>
                <DogStatusBadges
                  healthStatus={profile.snapshot.healthTestingSummary.badgeStatus}
                  fullHealthClearance={
                    profile.snapshot.healthTestingSummary.hasFullClearance
                  }
                  isListedForSale={Boolean(saleListing)}
                  isListedAtStud={Boolean(studListing)}
                  isPregnant={
                    profile.activeBreedingAttempt?.breedingStatus === "PREGNANT"
                  }
                  size="lg"
                />
              </div>

              {actions.canName ? (
                <RegisterDogNameForm
                  action={`/api/dogs/${header.dogId}/rename${validatedKennelRunId ? `?kennelRunId=${encodeURIComponent(validatedKennelRunId)}` : ""}`}
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
                  className="theme-card mt-4 max-w-3xl rounded-2xl p-2"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                    {dogRosterNavigation.previousDog ? (
                      <Link
                        href={`/dogs/${dogRosterNavigation.previousDog.id}?kennelRunId=${encodeURIComponent(dogRosterNavigation.kennelRunId)}`}
                        className="theme-card-interactive flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-sm font-semibold"
                      >
                        <span>&larr; Previous Dog</span>
                        <span className="theme-copy mt-0.5 truncate text-xs font-medium">
                          Previous: {dogRosterNavigation.previousDog.displayName}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex min-h-12 flex-col justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-disabled)]">
                        <span>&larr; Previous Dog</span>
                        <span className="mt-0.5 text-xs font-medium">
                          Previous: None
                        </span>
                      </span>
                    )}

                    <div className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-inset)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                      Dog {dogRosterNavigation.currentIndex + 1} of{" "}
                      {dogRosterNavigation.totalDogs}
                    </div>

                    {dogRosterNavigation.nextDog ? (
                      <Link
                        href={`/dogs/${dogRosterNavigation.nextDog.id}?kennelRunId=${encodeURIComponent(dogRosterNavigation.kennelRunId)}`}
                        className="theme-card-interactive flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-left text-sm font-semibold sm:text-right"
                      >
                        <span>Next Dog &rarr;</span>
                        <span className="theme-copy mt-0.5 truncate text-xs font-medium">
                          Next: {dogRosterNavigation.nextDog.displayName}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex min-h-12 flex-col justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-left text-sm font-semibold text-[var(--color-text-disabled)] sm:text-right">
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
                {marketSaleListing ? (
                  <form
                    action={`/api/market-dogs/${marketSaleListing.listingId}/buy?from=market`}
                    method="post"
                  >
                    <button
                      type="submit"
                      className="theme-primary-button w-full rounded-2xl px-5 py-3 text-sm font-semibold"
                    >
                      Buy Dog
                    </button>
                  </form>
                ) : null}

                <BreedDogActionButton
                  canBreed={actions.canBreed}
                  breedHref={`/breed?dogId=${header.dogId}`}
                  unavailableMessage={actions.breedingDisabledReason ?? null}
                />

                {canEnterShow ? (
                  <Link
                    href={`/dogs/${header.dogId}/show-entry`}
                    className="theme-primary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
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
                    <summary className="theme-primary-button list-none rounded-2xl px-5 py-3 text-center text-sm font-semibold [&::-webkit-details-marker]:hidden">
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
                                className="theme-primary-button w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
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
                                className="theme-secondary-button w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
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
                    action={`/api/dogs/${header.dogId}/list-for-sale${dogPageMutationContext}`}
                  />
                ) : (actions.canEditSaleListing ||
                    actions.canCancelSaleListing) && saleListing ? (
                  <ManageDogListingForm
                    dogId={header.dogId}
                    listingId={saleListing.listingId}
                    currentPrice={saleListing.askingPrice}
                    updateAction={`/api/market-dogs/${saleListing.listingId}/update-price${dogPageMutationContext}`}
                    cancelAction={`/api/market-dogs/${saleListing.listingId}/cancel${dogPageMutationContext}`}
                  />
                ) : null}

                <DogProfileKennelRunMove
                  dogId={header.dogId}
                  currentRunId={profile.currentRun?.runId ?? null}
                  currentRunName={profile.currentRun?.name ?? null}
                  canMove={canMoveKennelRun}
                >
                  {actions.canRehome && actions.rehomePayout !== null ? (
                    <RehomeDogForm
                      action={`/api/dogs/${header.dogId}/rehome`}
                      dogName={header.displayName}
                      payout={actions.rehomePayout}
                    />
                  ) : null}
                </DogProfileKennelRunMove>
              </div>

              <Link
                href={`/dogs/${header.dogId}/ribbon-room`}
                className="theme-secondary-button w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold"
              >
                Ribbon Room
              </Link>

              <div className="grid gap-3 sm:grid-cols-2">
                {actions.canUseActiveStudListing && studListing ? (
                  <Link
                    href={`/breed?studListingId=${studListing.listingId}`}
                    className="theme-primary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
                  >
                    Use At Stud for {formatMoney(studListing.studFee)}
                  </Link>
                ) : null}

                {actions.canOfferAtStud ? (
                  <OfferDogAtStudForm
                    action={`/api/dogs/${header.dogId}/list-at-stud${dogPageMutationContext}`}
                  />
                ) : (actions.canEditStudFee ||
                    actions.canCancelStudListing) && studListing ? (
                  <ManageDogStudListingForm
                    dogId={header.dogId}
                    listingId={studListing.listingId}
                    currentPrice={studListing.studFee}
                    updateAction={`/api/stud-listings/${studListing.listingId}/update-price${dogPageMutationContext}`}
                    cancelAction={`/api/stud-listings/${studListing.listingId}/cancel${dogPageMutationContext}`}
                  />
                ) : null}
              </div>

            </div>

          </div>
        </section>

        <DogProfileDashboard
          profile={profile}
          currentEpoch={currentEpoch}
          kennelRunId={navigationKennelRunId}
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
