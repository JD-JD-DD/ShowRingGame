import Link from "next/link";

import {
  buildDogActionWindows,
  type DogActionWindowCard as DogActionWindowCardDto,
  type DogActionWindowTone,
} from "@/lib/dogActionWindows";
import { formatShowAwardLabels } from "@/lib/showAwards";
import type { DogProfileDto } from "@/server/mappers/dog.mapper";

import CollapsibleDogSection from "./CollapsibleDogSection";
import DogPedigreeGrid from "./DogPedigreeGrid";
import EmergencyVetCarePanel from "./EmergencyVetCarePanel";
import DogPrivateNotesEditor from "./DogPrivateNotesEditor";
import HealthTestingPanel from "./HealthTestingPanel";
import TraitLine from "../ui/TraitLine";

const PANEL_CLASS = "dog-panel rounded-[28px] p-6";
const CARD_CLASS = "dog-card rounded-2xl px-4 py-3";

type Props = {
  profile: DogProfileDto;
  areaId: string | null;
  currentEpoch: number;
  healthMessage: string | null;
  healthError: string | null;
  notesMessage: string | null;
  notesError: string | null;
  showMessage: string | null;
  showError: string | null;
};

function statusMessage(message: string | null, isError = false) {
  if (!message) return null;
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${isError ? "border-red-400/25 bg-red-500/10 text-red-700 dark:text-red-200" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"}`}>
      {message}
    </div>
  );
}

function healthStatusLabel(profile: DogProfileDto): string {
  const summary = profile.snapshot.healthTestingSummary;
  if (summary.completedCount === 0) return "Not tested";
  if (summary.badgeStatus === "red") return "Has failing result";
  if (summary.badgeStatus === "yellow") return "Review results";
  if (summary.hasFullClearance) return "Full health clearance";
  return "Incomplete";
}

function actionWindowToneClass(tone: DogActionWindowTone): string {
  switch (tone) {
    case "ready":
      return "border-emerald-300/25 bg-emerald-500/10";
    case "complete":
      return "border-sky-300/25 bg-sky-500/10";
    case "closed":
    case "unavailable":
      return "border-white/10 bg-white/[0.03] opacity-75";
    case "pending":
      return "border-purple-300/20 bg-purple-500/10";
    default:
      return "border-[var(--dog-border)] bg-purple-500/5";
  }
}

export default function DogProfileDashboard(props: Props) {
  const { profile, areaId } = props;
  const { header, snapshot, viewerContext } = profile;
  const healthControls = profile.healthTesting.ownerControls;
  const saleListing = profile.breedingAndProduction.activeSaleListing;
  const studListing = profile.breedingAndProduction.activeStudListing;
  const breederName =
    header.originLabel === "Foundation Dog"
      ? "Foundation"
      : snapshot.breeder?.name ?? "Breeder unknown";
  const snapshotFacts = [
    `Sex: ${header.sexLabel}`,
    `Age: ${header.ageLabel}`,
    header.lifecycleLabel,
    breederName,
    ...(snapshot.marketLabel !== "Not for sale" ? [snapshot.marketLabel] : []),
    `Show: ${snapshot.showEligibilityLabel}`,
    `Breeding: ${snapshot.breedingEligibilityLabel}`,
  ];
  const actionWindows = buildDogActionWindows({
    ageHours: header.ageHours,
    sex: header.sex,
    lifecycleState: header.lifecycleState,
    currentEpoch: props.currentEpoch,
    canShow: snapshot.canShow,
    canBreed: snapshot.canBreed,
    canGroom: profile.groomingDetails?.canGroom ?? false,
    groomedThisWeek: profile.groomingDetails?.groomedThisWeek ?? false,
    nextGroomingResetEpoch:
      profile.groomingDetails?.nextGroomingResetEpoch ?? null,
    breedingStatus: profile.activeBreedingAttempt?.breedingStatus ?? null,
    pregCheckEpoch: profile.activeBreedingAttempt?.pregCheckEpoch ?? null,
    dueEpoch: profile.activeBreedingAttempt?.dueEpoch ?? null,
  });
  const actionWindowCards = [
    actionWindows.showWindow,
    actionWindows.breedingWindow,
    actionWindows.groomingWindow,
    actionWindows.nextMilestone,
  ];

  return (
    <section className="grid items-start gap-6 lg:grid-cols-6">
      {viewerContext.canManage && profile.emergencyCare ? (
        <EmergencyVetCarePanel
          dogId={header.dogId}
          dogName={header.displayName}
          emergency={profile.emergencyCare}
          className={`${PANEL_CLASS} order-0 lg:col-span-6`}
        />
      ) : null}

      <CollapsibleDogSection
        title="Snapshot"
        description="Identity and current state at a glance."
        className={`${PANEL_CLASS} order-1 lg:col-span-2 lg:order-1`}
        collapsedContent={<CompactFacts facts={snapshotFacts} />}
        contentClassName="mt-4"
        titleClassName="text-xl"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryValue label="Registration number" value={header.regNumber} />
          <SummaryValue label="Breed" value={header.breedName} />
          <SummaryValue label="Sex" value={header.sexLabel} />
          <SummaryValue label="Age" value={header.ageLabel} />
          <LinkedSummaryValue label="Owner kennel" value={snapshot.owner?.name ?? "Unowned"} href={snapshot.owner ? `/kennels/${snapshot.owner.slug}` : null} />
          <LinkedSummaryValue label="Breeder kennel" value={breederName} href={snapshot.breeder ? `/kennels/${snapshot.breeder.slug}` : null} />
          <LinkedSummaryValue label="Sire" value={snapshot.sire?.displayName ?? "Unknown"} href={snapshot.sire?.profileUrl ?? null} />
          <LinkedSummaryValue label="Dam" value={snapshot.dam?.displayName ?? "Unknown"} href={snapshot.dam?.profileUrl ?? null} />
          <SummaryValue label="Lifecycle" value={header.lifecycleLabel} />
          <SummaryValue label="Market" value={snapshot.marketLabel} />
        </div>
        <div className="mt-5">
          <h3 className="dog-heading font-semibold">Current Action Windows</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {actionWindowCards.map((card) => (
              <ActionWindowCard key={card.label} card={card} />
            ))}
          </div>
        </div>
      </CollapsibleDogSection>

      <CollapsibleDogSection
        title="Quality & Presentation"
        description="Public directional ring categories on a 0–20 scale with 10 as ideal."
        className={`${PANEL_CLASS} order-2 lg:col-span-6 lg:order-4`}
        contentClassName="mt-6 grid gap-x-8 gap-y-5 lg:grid-cols-2"
        defaultOpen
      >
        {profile.qualityAndPresentation.visibleCategories.map((category) => (
          <TraitLine key={category.key} label={category.label} value={category.numericScore} min={category.min} max={category.max} ideal={category.ideal} leftLabel={category.leftLabel} rightLabel={category.rightLabel} />
        ))}
      </CollapsibleDogSection>

      <CollapsibleDogSection
        title="Championship Summary"
        description={profile.titlesAndShowCareer.summaryLabel}
        badge={<Link href={profile.titlesAndShowCareer.fullShowRecordUrl} className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">Full record</Link>}
        className={`${PANEL_CLASS} order-3 lg:col-span-2 lg:order-2`}
        collapsedContent={
          <div className="flex flex-wrap gap-2">
            <span className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs font-semibold">{profile.titlesAndShowCareer.currentTitleCode ?? "None"}</span>
            {header.visibleTitlePrefix ? <span className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs">Prefix: {header.visibleTitlePrefix}</span> : null}
            {header.visibleTitleSuffix ? <span className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs">Suffix: {header.visibleTitleSuffix}</span> : null}
          </div>
        }
        contentClassName="mt-4 space-y-4"
        titleClassName="text-xl"
      >
        <div className="grid grid-cols-2 gap-2">
          <SummaryValue label="CH points" value={`${profile.titlesAndShowCareer.pointsEarned}/${profile.titlesAndShowCareer.pointsRequired}`} />
          <SummaryValue label="Majors" value={`${profile.titlesAndShowCareer.majorsEarned}/${profile.titlesAndShowCareer.majorsRequired}`} />
          <SummaryValue label="Title prefix" value={header.visibleTitlePrefix ?? "None"} />
          <SummaryValue label="Title suffix" value={header.visibleTitleSuffix ?? "None"} />
        </div>
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="dog-heading text-lg font-semibold">Recent show record</h3>
            <Link href={profile.titlesAndShowCareer.fullShowRecordUrl} className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">View full record</Link>
          </div>
          {profile.titlesAndShowCareer.recentShowResults.length > 0 ? (
            <div className="grid gap-2">
              {profile.titlesAndShowCareer.recentShowResults.slice(0, 3).map((result) => (
                <div key={result.resultId} className="dog-card rounded-xl px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={result.showUrl} className="dog-heading min-w-0 truncate font-semibold hover:underline">
                      {result.showName}
                    </Link>
                    <span className="dog-heading shrink-0 font-semibold">
                      {result.pointsAwarded} pt{result.pointsAwarded === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="dog-copy mt-1 flex flex-wrap gap-x-2">
                    <span>{result.showDateLabel}</span>
                    <span>{formatShowAwardLabels(result.awardCodes) || "No placement"}</span>
                    <Link href={result.judgeProfileUrl} className="hover:underline">{result.judgeName}</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dog-card dog-copy rounded-xl px-3 py-3 text-sm">No completed show results yet.</div>
          )}
        </div>
      </CollapsibleDogSection>

      <CollapsibleDogSection
        title="Health / Grooming Summary"
        description={`${profile.healthTesting.summaryLabel} · ${snapshot.groomingLabel ?? "Grooming unavailable"}`}
        className={`${PANEL_CLASS} order-4 lg:col-span-2 lg:order-3`}
        collapsedContent={
          <CompactFacts facts={[
            profile.healthTesting.summaryLabel,
            healthStatusLabel(profile),
            snapshot.coatConditionDisplay ? `Coat: ${snapshot.coatConditionDisplay}` : "Coat unavailable",
            snapshot.groomingLabel ?? "Grooming unavailable",
          ]} />
        }
        contentClassName="mt-4 space-y-4"
        titleClassName="text-xl"
      >
        {statusMessage(props.healthMessage)}
        {statusMessage(props.healthError, true)}
        <HealthTestingPanel dogId={header.dogId} areaId={areaId} kennelBalance={healthControls?.kennelBalance ?? 0} canOrderHealthTests={Boolean(healthControls?.checkoutNeeded)} rows={profile.healthTesting.tests.map((test) => ({ testTypeCode: test.testCode, label: test.displayName, fee: test.cost, isAvailable: test.isCurrentlyAvailable, availabilityLabel: test.minimumAgeLabel, result: test.isComplete ? { label: test.resultLabel ?? "Complete", testedLabel: test.testedDateLabel ?? "Test date unavailable", severity: test.severityKey ?? "yellow", impactStatement: test.healthImpactStatement } : null }))} />
        {viewerContext.canManage && profile.groomingDetails ? (
          <div className="grid grid-cols-2 gap-2">
            <SummaryValue label="Grooming state" value={profile.groomingDetails.groomingStatus} />
            <SummaryValue label="Actions remaining" value={`${profile.groomingDetails.weeklyActionsRemaining}/${profile.groomingDetails.weeklyActionLimit}`} />
            <SummaryValue label="Coat condition" value={profile.groomingDetails.currentCoatCondition.toFixed(2)} />
            <SummaryValue label="Net coat effect" value={`${profile.groomingDetails.netGroomingEffect >= 0 ? "+" : ""}${profile.groomingDetails.netGroomingEffect.toFixed(2)}`} />
          </div>
        ) : null}
      </CollapsibleDogSection>

      <CollapsibleDogSection title="Pedigree Preview" description="Four-generation ancestry and public health markers." badge={<Link href={`/dogs/${header.dogId}/pedigree`} className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">Full pedigree</Link>} className={`${PANEL_CLASS} order-5 lg:col-span-3 lg:order-5`} contentClassName="mt-4 space-y-4" titleClassName="text-xl">
        <div className="flex flex-wrap gap-2">{[profile.pedigree.coiLabel, profile.pedigree.colorLabel, profile.pedigree.healthTestsSummary].map((label) => <span key={label} className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs">{label}</span>)}</div>
        <DogPedigreeGrid ancestors={profile.pedigree.ancestors} compact />
      </CollapsibleDogSection>

      <CollapsibleDogSection title="Breeding & Production" description={`${profile.breedingAndProduction.productionRoleLabel} · ${profile.breedingAndProduction.breedingEligibilityLabel}`} className={`${PANEL_CLASS} order-6 lg:col-span-3 lg:order-6`} contentClassName="mt-4 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2"><SummaryValue label="Champion offspring" value={String(profile.breedingAndProduction.championOffspringCount)} /><SummaryValue label="Producer merit" value={profile.breedingAndProduction.producerMerit.currentMeritLabel ?? "None"} detail={profile.breedingAndProduction.producerMerit.progressLabel} /></div>
        {saleListing || studListing ? <div className={CARD_CLASS}>{saleListing ? <div>For sale · ${saleListing.askingPrice.toLocaleString()}</div> : null}{studListing ? <div>At stud · ${studListing.studFee.toLocaleString()}</div> : null}</div> : null}
        {profile.breedingAndProduction.sireHistory.map((item) => <div key={item.attemptId} className={`${CARD_CLASS} dog-copy text-sm`}>{item.usingKennelName} used him on {item.dateUsedLabel} with <Link href={item.damUrl} className="dog-heading font-semibold hover:underline">{item.damName}</Link>. {item.litterUrl ? <Link href={item.litterUrl} className="dog-heading font-semibold hover:underline">View litter</Link> : item.attemptStatusLabel}</div>)}
        {profile.breedingAndProduction.damHistory.map((item) => <div key={item.attemptId} className={`${CARD_CLASS} dog-copy text-sm`}>Bred to <Link href={item.sireUrl} className="dog-heading font-semibold hover:underline">{item.sireName}</Link> on {item.breedingDateLabel}. {item.attemptStatusLabel}.{item.puppyCount !== null ? ` ${item.puppyCount} puppies, ${item.survivedCount ?? 0} survived.` : ""}</div>)}
        <div><h3 className="dog-heading font-semibold">Progeny</h3><div className="mt-3 grid gap-2">{profile.breedingAndProduction.progeny.length > 0 ? profile.breedingAndProduction.progeny.map((offspring) => <Link key={offspring.dogId} href={offspring.dogUrl} className="dog-card-interactive flex items-center justify-between rounded-2xl px-4 py-3 text-sm"><span className="dog-heading font-medium">{offspring.displayName}</span><span className="dog-copy">{offspring.sexLabel}</span></Link>) : <div className="dog-card dog-copy rounded-2xl p-4 text-sm">No progeny recorded.</div>}</div></div>
      </CollapsibleDogSection>

      {viewerContext.canManage && profile.entries ? <CollapsibleDogSection title="Entries" description="Your dog’s next three show entries." badge={<span className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">{profile.entries.currentEntriesCount}</span>} className={`${PANEL_CLASS} order-7 lg:col-span-2 lg:order-7`} contentClassName="mt-4 space-y-3" titleClassName="text-xl">
        {statusMessage(props.showMessage)}{statusMessage(props.showError, true)}
        {profile.entries.nextEntries.length > 0 ? profile.entries.nextEntries.map((entry) => <div key={entry.entryId} className={`${CARD_CLASS} text-sm`}><Link href={entry.showUrl} className="dog-heading font-semibold hover:underline">{entry.showName}</Link><div className="dog-copy text-xs">{entry.showDateLabel} · Day {entry.showDayNumber} · {entry.district}</div>{entry.canPullEntry && entry.pullEntryActionUrl ? <form action={entry.pullEntryActionUrl} method="post" className="mt-2"><input type="hidden" name="dogId" value={header.dogId} />{areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}<button type="submit" className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-200">Pull entry</button></form> : null}</div>) : <div className="dog-card dog-copy rounded-2xl p-4 text-sm">No upcoming show entries.</div>}
      </CollapsibleDogSection> : null}

      {viewerContext.canViewPrivatePlanning && profile.privatePlanning ? <CollapsibleDogSection title="Private Planner" description="Owner-only notes and program tags." className={`${PANEL_CLASS} order-8 lg:col-span-2 lg:order-8`} contentClassName="mt-4 space-y-4" titleClassName="text-xl">
        {profile.privatePlanning.programPlannerTags.map((tag) => <div key={`${tag.tagTypeLabel}-${tag.updatedAt}`} className={`${CARD_CLASS} dog-copy text-sm`}><div className="flex justify-between gap-2"><span className="dog-heading font-semibold">{tag.tagTypeLabel}</span><span className="dog-label text-xs">{tag.goalLabel}</span></div><div className="mt-2 whitespace-pre-wrap">{tag.note ?? "No planner note saved."}</div></div>)}
        {profile.privatePlanning.canEditNotes ? <DogPrivateNotesEditor action={`/api/dogs/${header.dogId}/notes`} areaId={areaId} initialNotes={profile.privatePlanning.notes ?? ""} notesError={props.notesError} notesMessage={props.notesMessage} /> : null}
      </CollapsibleDogSection> : null}
    </section>
  );
}

function CompactFacts({ facts }: { facts: string[] }) {
  return <div className="flex flex-wrap gap-2">{facts.map((fact) => <span key={fact} className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs font-medium">{fact}</span>)}</div>;
}

function SummaryValue({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="dog-card rounded-xl px-3 py-2"><div className="dog-label text-[10px] uppercase tracking-wide">{label}</div><div className="dog-heading mt-0.5 text-sm font-semibold">{value}</div>{detail ? <div className="dog-copy mt-0.5 text-[11px]">{detail}</div> : null}</div>;
}

function ActionWindowCard({ card }: { card: DogActionWindowCardDto }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${actionWindowToneClass(card.tone)}`}>
      <div className="dog-label text-[10px] uppercase tracking-wide">
        {card.label}
      </div>
      <div className="dog-heading mt-0.5 text-sm font-semibold leading-snug">
        {card.value}
      </div>
    </div>
  );
}

function LinkedSummaryValue({ label, value, href }: { label: string; value: string; href: string | null }) {
  return <div className="dog-card rounded-xl px-3 py-2"><div className="dog-label text-[10px] uppercase tracking-wide">{label}</div>{href ? <Link href={href} className="dog-heading mt-0.5 block truncate text-sm font-semibold hover:underline">{value}</Link> : <div className="dog-heading mt-0.5 truncate text-sm font-semibold">{value}</div>}</div>;
}
