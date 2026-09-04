import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BreedingActiveControl from "@/components/dogs/BreedingActiveControl";
import BreedDogActionButton from "@/components/dogs/BreedDogActionButton";
import CallNameEditor from "@/components/dogs/CallNameEditor";
import DogProfileKennelRunMove from "@/components/dogs/DogProfileKennelRunMove";
import DogProfileGroomingManagement from "@/components/dogs/DogProfileGroomingManagement";
import DogProfileHealthActions from "@/components/dogs/DogProfileHealthActions";
import DogProfilePrivatePlanning from "@/components/dogs/DogProfilePrivatePlanning";
import DogProfileReadSections from "@/components/dogs/DogProfileReadSections";
import DogProfileShowsManagement from "@/components/dogs/DogProfileShowsManagement";
import EmergencyVetCarePanel from "@/components/dogs/EmergencyVetCarePanel";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import ManageDogPanel from "@/components/dogs/ManageDogPanel";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import RehomeDogForm from "@/components/dogs/RehomeDogForm";
import ReproductiveEmergencyPanel from "@/components/dogs/ReproductiveEmergencyPanel";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";
import { getDogProfile } from "@/server/services/dog.service";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getEligibleStandardBreedArtworkCampaigns } from "@/server/services/artCampaign.service";

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

  const dogBreed = await db.dog.findUnique({
    where: { id: dogId },
    select: { breedCode2: true },
  });
  const breedArtwork = dogBreed
    ? (await getEligibleStandardBreedArtworkCampaigns()).find(
        (campaign) =>
          campaign.breedCode2 === dogBreed.breedCode2 &&
          campaign.artworkAssetReference
      )
    : null;

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
  const { header, actions, viewerContext } = profile;
  const canMoveKennelRun =
    viewerContext.isOwnedByCurrentKennel && header.lifecycleState === "ALIVE";
  const canEnterShow =
    viewerContext.isOwnedByCurrentKennel &&
    header.lifecycleState === "ALIVE" &&
    profile.snapshot.canShow;
  const saleListing = profile.breedingAndProduction.activeSaleListing;
  const studListing = profile.breedingAndProduction.activeStudListing;
  const canConfigureStudOffer =
    actions.canOfferAtStud ||
    (Boolean(studListing) &&
      actions.canEditStudFee &&
      header.lifecycleState === "ALIVE" &&
      actions.isBreedingActive);
  const grooming = profile.groomingDetails;
  const dogPageMutationContext = navigationKennelRunId
    ? `?kennelRunId=${encodeURIComponent(navigationKennelRunId)}`
    : "";
  const dogPageReturnTo = `/dogs/${header.dogId}${navigationKennelRunId ? `?kennelRunId=${encodeURIComponent(navigationKennelRunId)}` : ""}`;
  const headerDisplayName = [
    header.visibleTitlePrefix,
    header.registeredName?.trim() || header.regNumber,
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
        {dogRosterNavigation ? (
          <nav aria-label="Kennel run dog navigation" className="mb-8 border-b border-[var(--color-border)] pb-5">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              {dogRosterNavigation.previousDog ? <Link href={`/dogs/${dogRosterNavigation.previousDog.id}?kennelRunId=${encodeURIComponent(dogRosterNavigation.kennelRunId)}`} className="theme-card-interactive flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-sm font-semibold"><span>&larr; Previous Dog</span><span className="theme-copy mt-0.5 truncate text-xs font-medium">Previous: {dogRosterNavigation.previousDog.displayName}</span></Link> : <span className="flex min-h-12 flex-col justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-disabled)]"><span>&larr; Previous Dog</span><span className="mt-0.5 text-xs font-medium">Previous: None</span></span>}
              <div className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-inset)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Dog {dogRosterNavigation.currentIndex + 1} of {dogRosterNavigation.totalDogs}</div>
              {dogRosterNavigation.nextDog ? <Link href={`/dogs/${dogRosterNavigation.nextDog.id}?kennelRunId=${encodeURIComponent(dogRosterNavigation.kennelRunId)}`} className="theme-card-interactive flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-left text-sm font-semibold sm:text-right"><span>Next Dog &rarr;</span><span className="theme-copy mt-0.5 truncate text-xs font-medium">Next: {dogRosterNavigation.nextDog.displayName}</span></Link> : <span className="flex min-h-12 flex-col justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-left text-sm font-semibold text-[var(--color-text-disabled)] sm:text-right"><span>Next Dog &rarr;</span><span className="mt-0.5 text-xs font-medium">Next: None</span></span>}
            </div>
          </nav>
        ) : null}
        <section className="grid gap-x-8 gap-y-0 border-b border-[var(--color-border)] pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="order-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[var(--color-surface-inset)]">
              {breedArtwork?.artworkAssetReference ? (
                <img src={breedArtwork.artworkAssetReference} alt={breedArtwork.artworkArtistCredit ? `${header.breedName} artwork by ${breedArtwork.artworkArtistCredit}` : `${header.breedName} breed artwork`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center"><p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Breed Art collection</p><h2 className="theme-heading mt-3 text-3xl font-semibold">Want Breed Art?</h2><p className="theme-copy mt-3 max-w-sm text-sm leading-6">Help fund future original artwork for this breed.</p><Link href="/breed-art" className="theme-primary-button mt-6 rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Explore Breed Art</Link></div>
              )}
            </div>
          </div>
          <div className="order-2 max-w-2xl">
              <div className="theme-label text-sm font-semibold uppercase tracking-[0.18em]">{header.breedName} · COLOR · {header.sexLabel}</div>
              <div className="mt-3">
                <h1 className="dog-heading text-4xl font-semibold tracking-tight sm:text-6xl">
                  {headerDisplayName}
                </h1>
              </div>
              {header.callName ? <p className="theme-copy mt-3 text-xl">&quot;{header.callName}&quot;</p> : null}
              <p className="theme-copy mt-5 text-sm leading-7">{header.lifecycleLabel} · {profile.snapshot.showEligibilityLabel} · {profile.snapshot.breedingEligibilityLabel}</p>

            <div className="relative mt-6 flex flex-wrap gap-3">
                {actions.canBuyActiveListing && saleListing ? (
                  <form
                    action={`/api/market-dogs/${saleListing.listingId}/buy?from=profile`}
                    method="post"
                  >
                    <button
                      type="submit"
                      className="theme-primary-button w-full rounded-2xl px-5 py-3 text-sm font-semibold"
                    >
                      Buy for {formatMoney(saleListing.askingPrice)}
                    </button>
                  </form>
                ) : null}

                {canEnterShow ? (
                  <Link
                    href={`/dogs/${header.dogId}/show-entry`}
                    className="theme-primary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
                  >
                    Show Planner
                  </Link>
                ) : (
                  <div className="dog-card dog-copy rounded-2xl px-5 py-3 text-center text-sm font-semibold opacity-60">
                    Show Planner
                  </div>
                )}

                {viewerContext.isOwnedByCurrentKennel &&
                header.lifecycleState === "ALIVE" ? (
                  <ManageDogPanel
                    dogName={header.callName ?? header.displayName}
                    callName={<CallNameEditor action={`/api/dogs/${header.dogId}/call-name${validatedKennelRunId ? `?kennelRunId=${encodeURIComponent(validatedKennelRunId)}` : ""}`} callName={header.callName} canEdit={viewerContext.isOwnedByCurrentKennel} />}
                    registerName={actions.canName ? <RegisterDogNameForm action={`/api/dogs/${header.dogId}/rename${validatedKennelRunId ? `?kennelRunId=${encodeURIComponent(validatedKennelRunId)}` : ""}`} nameError={nameError} /> : null}
                    moveRun={<DogProfileKennelRunMove dogId={header.dogId} currentRunId={profile.currentRun?.runId ?? null} currentRunName={profile.currentRun?.name ?? null} canMove={canMoveKennelRun} initiallyOpen />}
                    rehome={actions.canRehome && actions.rehomePayout !== null ? <RehomeDogForm action={`/api/dogs/${header.dogId}/rehome`} dogName={header.displayName} payout={actions.rehomePayout} /> : null}
                    breed={<BreedDogActionButton canBreed={actions.canBreed} breedHref={`/breed?dogId=${header.dogId}`} unavailableMessage={actions.breedingDisabledReason ?? null} />}
                    breedingParticipation={viewerContext.canManage ? <BreedingActiveControl action={`/api/dogs/${header.dogId}/breeding-active`} isBreedingActive={actions.isBreedingActive} /> : null}
                    grooming={grooming ? <DogProfileGroomingManagement dogId={header.dogId} dogName={header.displayName} grooming={grooming} returnTo={dogPageReturnTo} message={groomingMessage} error={groomingError} initiallyOpen /> : null}
                    shows={<DogProfileShowsManagement dogId={header.dogId} entries={profile.entries} kennelRunId={navigationKennelRunId} showMessage={showMessage} showError={showError} />}
                    showsCount={profile.entries?.currentEntriesCount ?? 0}
                    stud={
                      canConfigureStudOffer ? (
                        <Link
                          href={`/dogs/${header.dogId}/stud-contract`}
                          className="theme-secondary-button inline-block rounded-2xl px-5 py-3 text-center text-sm font-semibold"
                        >
                          Stud Worksheet
                        </Link>
                      ) : null
                    }
                    marketLabel={actions.canOfferForSale ? "List for sale" : "Manage listing"}
                    market={
                      actions.canOfferForSale ? (
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
                      ) : null
                    }
                  />
                ) : null}

                {actions.canUseActiveStudListing && studListing ? (
                  <Link
                    href={`/breed?studListingId=${studListing.listingId}`}
                    className="theme-primary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
                  >
                    Use At Stud for {formatMoney(studListing.studFee)}
                  </Link>
                ) : null}
            </div>
              {statusMessage(saleMessage)}
              {statusMessage(saleError, true)}
              <dl className="mt-8 grid gap-x-8 gap-y-5 border-y border-[var(--color-border)] py-6 sm:grid-cols-2">
                <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">Registration</dt><dd className="theme-heading mt-1 text-base font-semibold">{header.regNumber}</dd></div>
                <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">Game Age</dt><dd className="theme-heading mt-1 text-base font-semibold">{header.ageLabel}</dd></div>
                <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">Owner</dt><dd className="theme-heading mt-1 text-base font-semibold">{profile.snapshot.owner?.name ?? "Unowned"}</dd></div>
                <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">Breeder</dt><dd className="theme-heading mt-1 text-base font-semibold">{profile.snapshot.breeder?.name ?? (header.originLabel === "Foundation Dog" ? "Foundation" : "Breeder unknown")}</dd></div>
                <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">Kennel Run</dt><dd className="theme-heading mt-1 text-base font-semibold">{profile.currentRun?.name ?? "Unassigned"}</dd></div>
                <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">Health</dt><dd className="theme-heading mt-1 text-base font-semibold">{profile.healthTesting.summaryLabel}</dd></div>
              </dl>
            </div>
        </section>

        {viewerContext.canManage && header.lifecycleState === "ALIVE" && profile.emergencyCare ? <EmergencyVetCarePanel dogId={header.dogId} dogName={header.displayName} emergency={profile.emergencyCare} className="dog-panel mt-8 rounded-[28px] p-6" /> : null}
        {viewerContext.canManage && header.lifecycleState === "ALIVE" && profile.reproductiveEmergency ? <ReproductiveEmergencyPanel dogName={header.displayName} emergency={profile.reproductiveEmergency} className="dog-panel mt-8 rounded-[28px] p-6" /> : null}
        <DogProfileReadSections
          profile={profile}
          healthActions={<DogProfileHealthActions profile={profile} kennelRunId={navigationKennelRunId} canManage={viewerContext.canManage && header.lifecycleState === "ALIVE"} healthMessage={healthMessage} healthError={healthError} />}
          privatePlanning={<DogProfilePrivatePlanning profile={profile} kennelRunId={navigationKennelRunId} notesMessage={notesMessage} notesError={notesError} />}
        />
      </div>
    </main>
  );
}
