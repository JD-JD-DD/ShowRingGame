import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CancelGroomingListingForm from "@/components/dogs/CancelGroomingListingForm";
import CollapsibleDogSection from "@/components/dogs/CollapsibleDogSection";
import DogPrivateNotesEditor from "@/components/dogs/DogPrivateNotesEditor";
import HealthTestingPanel from "@/components/dogs/HealthTestingPanel";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import ManageDogStudListingForm from "@/components/dogs/ManageDogStudListingForm";
import OfferDogAtStudForm from "@/components/dogs/OfferDogAtStudForm";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import RehomeDogForm from "@/components/dogs/RehomeDogForm";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import TraitLine from "@/components/ui/TraitLine";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getDogProfile } from "@/server/services/dog.service";
import { getKennelForUser } from "@/server/services/kennel.service";

const DOG_PANEL_CLASS = "dog-panel rounded-[28px] p-6";
const DOG_CARD_CLASS = "dog-card rounded-2xl px-4 py-3";

type DogSearchParams = {
    areaId?: string | string[];
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

function firstQueryValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
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
      return "border-purple-300/25 bg-purple-500/10 text-purple-100";
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

  const areaId = firstQueryValue(resolvedSearchParams.areaId);
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
  const { header, snapshot, actions, viewerContext } = profile;
  const saleListing = profile.breedingAndProduction.activeSaleListing;
  const studListing = profile.breedingAndProduction.activeStudListing;
  const grooming = profile.groomingDetails;
  const healthOwnerControls = profile.healthTesting.ownerControls;
  const dogPageReturnTo = `/dogs/${header.dogId}${
    areaId ? `?areaId=${encodeURIComponent(areaId)}` : ""
  }`;

  return (
    <main className="dog-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="dog-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Show Profile
              </div>
              <div className="text-sm font-medium text-purple-200">
                {header.breedName}
              </div>
              <h1 className="dog-heading mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {header.displayName}
              </h1>
              <div className="dog-copy mt-3 text-sm">{header.regNumber}</div>

              {actions.canName ? (
                <RegisterDogNameForm
                  action={`/api/dogs/${header.dogId}/rename`}
                  areaId={areaId}
                  nameError={nameError}
                />
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  Sex: {header.sexLabel}
                </span>
                <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  Age: {header.ageLabel}
                </span>
                <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  Status: {header.lifecycleLabel}
                </span>
                <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  {header.originLabel}
                </span>
                {header.badges.map((badge) => (
                  <span
                    key={badge.code}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(badge.tone)}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>

              {statusMessage(saleMessage)}
              {statusMessage(saleError, true)}
              {statusMessage(groomingMessage)}
              {statusMessage(groomingError, true)}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
              <Link
                href="/kennel"
                className="dog-secondary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
              >
                Back to My Kennel
              </Link>

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

              {actions.canOfferForSale ? (
                <OfferDogForSaleForm
                  action={`/api/dogs/${header.dogId}/list-for-sale`}
                  areaId={areaId}
                />
              ) : (actions.canEditSaleListing ||
                  actions.canCancelSaleListing) && saleListing ? (
                <ManageDogListingForm
                  dogId={header.dogId}
                  listingId={saleListing.listingId}
                  currentPrice={saleListing.askingPrice}
                  updateAction={`/api/market-dogs/${saleListing.listingId}/update-price`}
                  cancelAction={`/api/market-dogs/${saleListing.listingId}/cancel`}
                  areaId={areaId}
                />
              ) : null}

              {actions.canOfferAtStud ? (
                <OfferDogAtStudForm
                  action={`/api/dogs/${header.dogId}/list-at-stud`}
                  areaId={areaId}
                />
              ) : (actions.canEditStudFee ||
                  actions.canCancelStudListing) && studListing ? (
                <ManageDogStudListingForm
                  dogId={header.dogId}
                  listingId={studListing.listingId}
                  currentPrice={studListing.studFee}
                  updateAction={`/api/stud-listings/${studListing.listingId}/update-price`}
                  cancelAction={`/api/stud-listings/${studListing.listingId}/cancel`}
                  areaId={areaId}
                />
              ) : null}

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

              {actions.canRehome && actions.rehomePayout !== null ? (
                <RehomeDogForm
                  action={`/api/dogs/${header.dogId}/rehome`}
                  dogName={header.displayName}
                  payout={actions.rehomePayout}
                  areaId={areaId}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <CollapsibleDogSection
            title="Visible Trait Categories"
            description="Public directional ring categories on a 0-20 scale with 10 as ideal."
            className={DOG_PANEL_CLASS}
            contentClassName="mt-6 space-y-4"
          >
            {profile.qualityAndPresentation.visibleCategories.map((category) => (
              <TraitLine
                key={category.key}
                label={category.label}
                value={category.numericScore}
                min={category.min}
                max={category.max}
                ideal={category.ideal}
                leftLabel={category.leftLabel}
                rightLabel={category.rightLabel}
              />
            ))}
          </CollapsibleDogSection>

          <div className="grid gap-6">
            <CollapsibleDogSection
              title="Identity"
              className={DOG_PANEL_CLASS}
              contentClassName="mt-4 grid gap-3 sm:grid-cols-2"
              titleClassName="text-xl"
            >
              <div className={DOG_CARD_CLASS}>
                <div className="dog-label text-xs uppercase tracking-wide">Breed</div>
                <div className="dog-heading mt-1 text-sm font-medium">
                  {header.breedName}
                </div>
              </div>
              <div className={DOG_CARD_CLASS}>
                <div className="dog-label text-xs uppercase tracking-wide">
                  Registration
                </div>
                <div className="dog-heading mt-1 text-sm font-medium">
                  {header.regNumber}
                </div>
              </div>
              <div className={DOG_CARD_CLASS}>
                <div className="dog-label text-xs uppercase tracking-wide">Owner</div>
                <div className="dog-heading mt-1 text-sm font-medium">
                  {snapshot.owner?.name ?? "Unowned"}
                </div>
              </div>
              <div className={DOG_CARD_CLASS}>
                <div className="dog-label text-xs uppercase tracking-wide">Breeder</div>
                <div className="dog-heading mt-1 text-sm font-medium">
                  {snapshot.breeder?.name ?? "Unknown"}
                </div>
              </div>
            </CollapsibleDogSection>

            <CollapsibleDogSection
              title="Current Status"
              className={DOG_PANEL_CLASS}
              contentClassName="mt-4 grid gap-3 sm:grid-cols-2"
              titleClassName="text-xl"
            >
              {[
                ["Lifecycle", header.lifecycleLabel],
                ["Market", snapshot.marketLabel],
                ["Show Eligibility", snapshot.showEligibilityLabel],
                ["Breeding Eligibility", snapshot.breedingEligibilityLabel],
                ["Coat Condition", snapshot.coatConditionDisplay ?? "Unavailable"],
                ["Grooming", snapshot.groomingLabel ?? "Private"],
              ].map(([label, value]) => (
                <div key={label} className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">{label}</div>
                  <div className="dog-heading mt-1 text-sm font-medium">{value}</div>
                </div>
              ))}
            </CollapsibleDogSection>
          </div>
        </section>

        <CollapsibleDogSection
          title="Title Progress"
          description={profile.titlesAndShowCareer.summaryLabel}
          badge={
            profile.titlesAndShowCareer.currentTitleCode ? (
              <span className="rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">
                {profile.titlesAndShowCareer.currentTitleCode}
              </span>
            ) : undefined
          }
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={DOG_CARD_CLASS}>
              <div className="dog-label text-xs uppercase tracking-wide">Points</div>
              <div className="dog-heading mt-1 text-sm font-medium">
                {profile.titlesAndShowCareer.pointsEarned}/
                {profile.titlesAndShowCareer.pointsRequired}
              </div>
            </div>
            <div className={DOG_CARD_CLASS}>
              <div className="dog-label text-xs uppercase tracking-wide">Majors</div>
              <div className="dog-heading mt-1 text-sm font-medium">
                {profile.titlesAndShowCareer.majorsEarned}/
                {profile.titlesAndShowCareer.majorsRequired}
              </div>
            </div>
          </div>
          {profile.titlesAndShowCareer.recentPointWins.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.titlesAndShowCareer.recentPointWins.map((win) => (
                <span
                  key={`${win.showDayId}-${win.awardCode}`}
                  className="rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100"
                >
                  {win.awardCode} · {win.pointsAwarded} pt
                  {win.pointsAwarded === 1 ? "" : "s"}
                  {win.isMajor ? " major" : ""}
                </span>
              ))}
            </div>
          ) : null}
        </CollapsibleDogSection>

        <CollapsibleDogSection
          title="Health Testing"
          description="Public phenotype screening results. Each test becomes available at its required age."
          badge={
            <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-100">
              {profile.healthTesting.summaryLabel}
            </span>
          }
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-4"
        >
          {statusMessage(healthMessage)}
          {statusMessage(healthError, true)}
          <HealthTestingPanel
            dogId={header.dogId}
            areaId={areaId}
            kennelBalance={healthOwnerControls?.kennelBalance ?? 0}
            canOrderHealthTests={Boolean(healthOwnerControls?.checkoutNeeded)}
            rows={profile.healthTesting.tests.map((test) => ({
              testTypeCode: test.testCode,
              label: test.displayName,
              fee: test.cost,
              isAvailable: test.isCurrentlyAvailable,
              availabilityLabel: test.minimumAgeLabel,
              result: test.isComplete
                ? {
                    label: test.resultLabel ?? "Complete",
                    testedLabel: test.testedDateLabel ?? "Test date unavailable",
                    severity: test.severityKey ?? "yellow",
                  }
                : null,
            }))}
          />
        </CollapsibleDogSection>

        <CollapsibleDogSection
          title="Show Record"
          description="Most recent published breed results for this dog."
          badge={
            <Link
              href={profile.titlesAndShowCareer.fullShowRecordUrl}
              className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold"
            >
              Full record
            </Link>
          }
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-5"
        >
          {profile.titlesAndShowCareer.recentShowResults.length === 0 ? (
            <div className="dog-card dog-copy rounded-2xl p-4 text-sm">
              No published show results yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="dog-label text-left text-xs uppercase tracking-[0.16em]">
                    <th className="px-3 py-2">Show</th>
                    <th className="px-3 py-2">Breed</th>
                    <th className="px-3 py-2">Judge</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.titlesAndShowCareer.recentShowResults.map((result) => (
                    <tr key={result.resultId} className="dog-card">
                      <td className="rounded-l-2xl px-3 py-3">
                        <Link href={result.showUrl} className="dog-heading font-semibold hover:underline">
                          {result.showName}
                        </Link>
                        <div className="dog-copy text-xs">
                          {result.showDateLabel} · Day {result.showDayNumber} ·{" "}
                          {result.districtRegion}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={result.breedResultUrl} className="font-semibold text-sky-100 hover:underline">
                          {result.breedCode2}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={result.judgeProfileUrl} className="dog-heading font-semibold hover:underline">
                          {result.judgeName}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{result.awardCodes.join(", ") || "None"}</td>
                      <td className="dog-heading rounded-r-2xl px-3 py-3 text-right font-semibold">
                        {result.pointsAwarded}
                        {result.isMajor ? <div className="text-xs text-amber-100">Major</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleDogSection>

        {viewerContext.canManage && profile.entries ? (
          <CollapsibleDogSection
            title="Upcoming Shows"
            description="Current entries for this dog. Visible only to your kennel."
            badge={
              <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                {profile.entries.currentEntriesCount} entries
              </span>
            }
            className={`${DOG_PANEL_CLASS} mb-8`}
            contentClassName="mt-4"
          >
            {statusMessage(showMessage)}
            {statusMessage(showError, true)}
            {profile.entries.allEntries.length === 0 ? (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm">
                No upcoming show entries.
              </div>
            ) : (
              <div className="grid gap-2">
                {profile.entries.allEntries.map((entry) => (
                  <div key={entry.entryId} className="dog-card flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={entry.showUrl} className="dog-heading font-semibold hover:underline">
                        {entry.showName}
                      </Link>
                      <div className="dog-copy text-xs">
                        {entry.showDateLabel} · Day {entry.showDayNumber} · {entry.district}
                      </div>
                      <div className="dog-copy text-xs">
                        {entry.breedName} · {entry.judgeName ?? "Judge unavailable"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs font-semibold">
                        {entry.entryStatusLabel}
                      </span>
                      {entry.canPullEntry && entry.pullEntryActionUrl ? (
                        <form action={entry.pullEntryActionUrl} method="post">
                          <input type="hidden" name="dogId" value={header.dogId} />
                          {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
                          <button type="submit" className="rounded-lg border border-red-300/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-100 transition hover:bg-red-500/20">
                            PULL
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleDogSection>
        ) : null}

        <CollapsibleDogSection
          title="Breeding & Production"
          description={`${profile.breedingAndProduction.productionRoleLabel} · ${profile.breedingAndProduction.breedingEligibilityLabel}`}
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-4 space-y-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={DOG_CARD_CLASS}>
              <div className="dog-label text-xs uppercase tracking-wide">Champion Offspring</div>
              <div className="dog-heading mt-1 text-sm font-medium">
                {profile.breedingAndProduction.championOffspringCount}
              </div>
            </div>
            <div className={DOG_CARD_CLASS}>
              <div className="dog-label text-xs uppercase tracking-wide">Producer Merit</div>
              <div className="dog-heading mt-1 text-sm font-medium">
                {profile.breedingAndProduction.producerMerit.currentMeritLabel ?? "None"}
              </div>
              <div className="dog-copy mt-1 text-xs">
                {profile.breedingAndProduction.producerMerit.progressLabel}
              </div>
            </div>
          </div>

          {profile.breedingAndProduction.sireHistory.length > 0 ? (
            <div>
              <h3 className="dog-heading font-semibold">Sire History</h3>
              <div className="mt-3 grid gap-2">
                {profile.breedingAndProduction.sireHistory.map((item) => (
                  <div key={item.attemptId} className="dog-card dog-copy rounded-2xl px-4 py-3 text-sm">
                    {item.usingKennelName} used him on {item.dateUsedLabel} with{" "}
                    <Link href={item.damUrl} className="dog-heading font-semibold hover:underline">
                      {item.damName}
                    </Link>
                    .{" "}
                    {item.litterUrl ? (
                      <Link href={item.litterUrl} className="font-semibold text-emerald-100 hover:underline">
                        View litter
                      </Link>
                    ) : (
                      item.attemptStatusLabel
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {profile.breedingAndProduction.damHistory.length > 0 ? (
            <div>
              <h3 className="dog-heading font-semibold">Dam History</h3>
              <div className="mt-3 grid gap-2">
                {profile.breedingAndProduction.damHistory.map((item) => (
                  <div key={item.attemptId} className="dog-card dog-copy rounded-2xl px-4 py-3 text-sm">
                    Bred to{" "}
                    <Link href={item.sireUrl} className="dog-heading font-semibold hover:underline">
                      {item.sireName}
                    </Link>{" "}
                    on {item.breedingDateLabel}. {item.attemptStatusLabel}.
                    {item.puppyCount !== null ? ` ${item.puppyCount} puppies, ${item.survivedCount ?? 0} survived.` : ""}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CollapsibleDogSection>

        <CollapsibleDogSection
          title="Four-Generation Pedigree"
          description="Recorded ancestors with public health markers."
          badge={
            <div className="flex flex-wrap gap-2">
              {[profile.pedigree.coiLabel, profile.pedigree.colorLabel, profile.pedigree.healthTestsSummary].map((label) => (
                <span key={label} className="dog-neutral-badge rounded-full px-3 py-1 text-xs">
                  {label}
                </span>
              ))}
            </div>
          }
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-5"
        >
          {profile.pedigree.ancestors.length === 0 ? (
            <div className="dog-card dog-copy rounded-2xl p-4 text-sm">
              No recorded ancestors.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {profile.pedigree.ancestors.map((ancestor) => (
                <Link key={`${ancestor.relationship}-${ancestor.dogId}`} href={ancestor.profileUrl} className="dog-card-interactive rounded-2xl px-4 py-3 text-sm">
                  <div className="dog-label text-xs uppercase tracking-wide">{ancestor.relationship}</div>
                  <div className="dog-heading mt-1 font-semibold">{ancestor.displayName}</div>
                  <div className="dog-copy mt-2 text-xs">{ancestor.colorLabel}</div>
                  {ancestor.detailedHealthResults.map((result) => (
                    <div key={result.testCode} className="dog-copy mt-1 text-xs">
                      {result.displayName}: {result.resultLabel}
                    </div>
                  ))}
                  {ancestor.healthSeverityCounts ? (
                    <div className="dog-copy mt-2 text-xs">
                      Health: {ancestor.healthSeverityCounts.green} green ·{" "}
                      {ancestor.healthSeverityCounts.yellow} yellow ·{" "}
                      {ancestor.healthSeverityCounts.red} red
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </CollapsibleDogSection>

        <section className="grid gap-6 lg:grid-cols-2">
          <CollapsibleDogSection title="Progeny" className={DOG_PANEL_CLASS} contentClassName="mt-4" titleClassName="text-xl">
            {profile.breedingAndProduction.progeny.length > 0 ? (
              <div className="grid gap-2">
                {profile.breedingAndProduction.progeny.map((offspring) => (
                  <Link key={offspring.dogId} href={offspring.dogUrl} className="dog-card-interactive flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
                    <span className="dog-heading font-medium">{offspring.displayName}</span>
                    <span className="dog-copy shrink-0">{offspring.sexLabel}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm">No progeny recorded.</div>
            )}
          </CollapsibleDogSection>

          <CollapsibleDogSection title="Active Listing" className={DOG_PANEL_CLASS} contentClassName="mt-4" titleClassName="text-xl">
            {saleListing || studListing ? (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm leading-7">
                {saleListing ? <div>For sale · {formatMoney(saleListing.askingPrice)}</div> : null}
                {studListing ? <div>At stud · {formatMoney(studListing.studFee)}</div> : null}
              </div>
            ) : (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm">No active listing.</div>
            )}
          </CollapsibleDogSection>
        </section>

        {viewerContext.canViewPrivatePlanning &&
        profile.privatePlanning?.programPlannerTags.length ? (
          <CollapsibleDogSection title="Program Planner" description="Private planner tags saved from your breed review." className={`${DOG_PANEL_CLASS} mt-6`} contentClassName="mt-4" titleClassName="text-xl">
            <div className="grid gap-3">
              {profile.privatePlanning.programPlannerTags.map((tag) => (
                <div key={`${tag.tagTypeLabel}-${tag.updatedAt}`} className="dog-card dog-copy rounded-2xl p-4 text-sm leading-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="dog-heading font-semibold">{tag.tagTypeLabel}</span>
                    <span className="dog-label text-xs uppercase tracking-wide">{tag.goalLabel}</span>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap">{tag.note ?? "No planner note saved for this tag."}</div>
                </div>
              ))}
            </div>
          </CollapsibleDogSection>
        ) : null}

        {viewerContext.canViewPrivatePlanning &&
        profile.privatePlanning?.canEditNotes ? (
          <CollapsibleDogSection title="Notes" description="Private notes for your kennel only." className={`${DOG_PANEL_CLASS} mt-6`} contentClassName="mt-4" titleClassName="text-xl">
            <DogPrivateNotesEditor
              action={`/api/dogs/${header.dogId}/notes`}
              areaId={areaId}
              initialNotes={profile.privatePlanning.notes ?? ""}
              notesError={notesError}
              notesMessage={notesMessage}
            />
          </CollapsibleDogSection>
        ) : null}
      </div>
    </main>
  );
}
