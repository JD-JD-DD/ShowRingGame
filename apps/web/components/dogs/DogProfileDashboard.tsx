import Link from "next/link";

import type { DogProfileDto } from "@/server/mappers/dog.mapper";

import CollapsibleDogSection from "./CollapsibleDogSection";
import DogPedigreeGrid from "./DogPedigreeGrid";
import DogPrivateNotesEditor from "./DogPrivateNotesEditor";
import DogShowRecordTable from "./DogShowRecordTable";
import HealthTestingPanel from "./HealthTestingPanel";
import TraitLine from "../ui/TraitLine";

const PANEL_CLASS = "dog-panel rounded-[28px] p-6";
const CARD_CLASS = "dog-card rounded-2xl px-4 py-3";

type Props = {
  profile: DogProfileDto;
  areaId: string | null;
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

export default function DogProfileDashboard(props: Props) {
  const { profile, areaId } = props;
  const { header, snapshot, viewerContext } = profile;
  const healthControls = profile.healthTesting.ownerControls;
  const saleListing = profile.breedingAndProduction.activeSaleListing;
  const studListing = profile.breedingAndProduction.activeStudListing;

  return (
    <section className="grid gap-6 lg:grid-cols-6">
      <CollapsibleDogSection title="Snapshot" description="Identity and current state at a glance." className={`${PANEL_CLASS} order-1 lg:col-span-2 lg:order-1`} contentClassName="mt-4 grid gap-3 sm:grid-cols-2" titleClassName="text-xl">
        {[
          ["Owner", snapshot.owner?.name ?? "Unowned"],
          ["Breeder", snapshot.breeder?.name ?? "Unknown"],
          ["Origin", snapshot.originLabel],
          ["Market", snapshot.marketLabel],
          ["Show", snapshot.showEligibilityLabel],
          ["Breeding", snapshot.breedingEligibilityLabel],
        ].map(([label, value]) => (
          <div key={label} className={CARD_CLASS}>
            <div className="dog-label text-xs uppercase tracking-wide">{label}</div>
            <div className="dog-heading mt-1 text-sm font-medium">{value}</div>
          </div>
        ))}
      </CollapsibleDogSection>

      <CollapsibleDogSection title="Quality & Presentation" description="Public directional ring categories on a 0–20 scale with 10 as ideal." className={`${PANEL_CLASS} order-2 lg:col-span-6 lg:order-4`} contentClassName="mt-6 grid gap-x-8 gap-y-5 lg:grid-cols-2" defaultOpen>
        {profile.qualityAndPresentation.visibleCategories.map((category) => (
          <TraitLine key={category.key} label={category.label} value={category.numericScore} min={category.min} max={category.max} ideal={category.ideal} leftLabel={category.leftLabel} rightLabel={category.rightLabel} />
        ))}
      </CollapsibleDogSection>

      <CollapsibleDogSection title="Championship Summary" description={profile.titlesAndShowCareer.summaryLabel} badge={profile.titlesAndShowCareer.currentTitleCode ? <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">{profile.titlesAndShowCareer.currentTitleCode}</span> : undefined} className={`${PANEL_CLASS} order-3 lg:col-span-2 lg:order-2`} contentClassName="mt-4" titleClassName="text-xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryValue label="Points" value={`${profile.titlesAndShowCareer.pointsEarned}/${profile.titlesAndShowCareer.pointsRequired}`} />
          <SummaryValue label="Majors" value={`${profile.titlesAndShowCareer.majorsEarned}/${profile.titlesAndShowCareer.majorsRequired}`} />
        </div>
        {profile.titlesAndShowCareer.recentPointWins.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{profile.titlesAndShowCareer.recentPointWins.map((win) => <span key={`${win.showDayId}-${win.awardCode}`} className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs font-semibold">{win.awardCode} · {win.pointsAwarded} pt{win.pointsAwarded === 1 ? "" : "s"}{win.isMajor ? " major" : ""}</span>)}</div> : null}
      </CollapsibleDogSection>

      <CollapsibleDogSection title="Health / Grooming Summary" description={`${profile.healthTesting.summaryLabel} · ${snapshot.groomingLabel ?? "Grooming unavailable"}`} badge={<span className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">{snapshot.coatConditionDisplay ?? "Coat unavailable"}</span>} className={`${PANEL_CLASS} order-4 lg:col-span-2 lg:order-3`} contentClassName="mt-4 space-y-4" titleClassName="text-xl">
        {statusMessage(props.healthMessage)}
        {statusMessage(props.healthError, true)}
        <HealthTestingPanel dogId={header.dogId} areaId={areaId} kennelBalance={healthControls?.kennelBalance ?? 0} canOrderHealthTests={Boolean(healthControls?.checkoutNeeded)} rows={profile.healthTesting.tests.map((test) => ({ testTypeCode: test.testCode, label: test.displayName, fee: test.cost, isAvailable: test.isCurrentlyAvailable, availabilityLabel: test.minimumAgeLabel, result: test.isComplete ? { label: test.resultLabel ?? "Complete", testedLabel: test.testedDateLabel ?? "Test date unavailable", severity: test.severityKey ?? "yellow" } : null }))} />
        {profile.groomingDetails ? <div className="grid gap-3 sm:grid-cols-2"><SummaryValue label="Grooming actions" value={`${profile.groomingDetails.weeklyActionsRemaining}/${profile.groomingDetails.weeklyActionLimit} remaining`} /><SummaryValue label="Net coat effect" value={`${profile.groomingDetails.netGroomingEffect >= 0 ? "+" : ""}${profile.groomingDetails.netGroomingEffect.toFixed(2)}`} /></div> : null}
      </CollapsibleDogSection>

      <CollapsibleDogSection title="Show Career" description="The six most recent published results." badge={<Link href={`/dogs/${header.dogId}/show-record`} className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">Full record</Link>} className={`${PANEL_CLASS} order-5 lg:col-span-3 lg:order-5`} contentClassName="mt-5">
        <DogShowRecordTable results={profile.titlesAndShowCareer.recentShowResults} />
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

      <CollapsibleDogSection title="Pedigree Preview" description="Four-generation ancestry and public health markers." badge={<Link href={`/dogs/${header.dogId}/pedigree`} className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">Full pedigree</Link>} className={`${PANEL_CLASS} order-9 lg:col-span-2 lg:order-9`} contentClassName="mt-4 space-y-4" titleClassName="text-xl">
        <div className="flex flex-wrap gap-2">{[profile.pedigree.coiLabel, profile.pedigree.colorLabel, profile.pedigree.healthTestsSummary].map((label) => <span key={label} className="dog-neutral-badge rounded-full px-2.5 py-1 text-xs">{label}</span>)}</div>
        <DogPedigreeGrid ancestors={profile.pedigree.ancestors} compact />
      </CollapsibleDogSection>
    </section>
  );
}

function SummaryValue({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className={CARD_CLASS}><div className="dog-label text-xs uppercase tracking-wide">{label}</div><div className="dog-heading mt-1 font-semibold">{value}</div>{detail ? <div className="dog-copy mt-1 text-xs">{detail}</div> : null}</div>;
}
