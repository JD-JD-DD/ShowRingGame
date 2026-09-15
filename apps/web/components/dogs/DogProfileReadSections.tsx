import Link from "next/link";
import type { ReactNode } from "react";

import type { DogProfileDto } from "@/server/mappers/dog.mapper";

import TraitLine from "@/components/ui/TraitLine";

import { PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES } from "./phenotypeHealthPresentation";

type Props = {
  profile: DogProfileDto;
  healthActions?: ReactNode;
  privatePlanning?: ReactNode;
};

export default function DogProfileReadSections({
  profile,
  healthActions,
  privatePlanning,
}: Props) {
  const {
    header,
    snapshot,
    qualityAndPresentation,
    healthTesting,
    titlesAndShowCareer,
    pedigree,
    breedingAndProduction,
  } = profile;
  const invitationalHonors = header.badges.filter((badge) =>
    badge.code.startsWith("invitational-")
  );
  const hasBreedingHistory =
    breedingAndProduction.damHistory.length > 0 ||
    breedingAndProduction.sireHistory.length > 0;
  const reproductiveStatusLabel =
    snapshot.reproductiveStatus?.label ?? snapshot.breedingEligibilityLabel;
  const reproductiveStatusDetail =
    snapshot.reproductiveStatus?.detail ?? snapshot.breedingEligibilityMessage;

  return (
    <div className="mt-12 space-y-12">
      <section aria-labelledby="ring-evaluation-heading">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Ring Evaluation</p>
        <h2 id="ring-evaluation-heading" className="theme-heading mt-2 text-3xl font-semibold">Conformation &amp; Presentation</h2>
        <p className="theme-copy mt-3 text-sm leading-7">Visible ring categories retain ShowRing&apos;s directional player-facing values.</p>
        <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {qualityAndPresentation.visibleCategories.map((category) => <TraitLine key={category.key} label={category.label} value={category.numericScore} min={category.min} max={category.max} ideal={category.ideal} leftLabel={category.leftLabel} centerLabel={category.centerLabel} rightLabel={category.rightLabel} precision={category.key === "conditioningHandling" ? 1 : 3} />)}
        </div>
      </section>

      <div className="grid gap-x-12 lg:grid-cols-2">
        <section className="border-t border-[var(--color-border)] py-8" aria-labelledby="health-heading">
          <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">{healthTesting.summaryLabel}</p>
          <h2 id="health-heading" className="theme-heading mt-2 text-2xl font-semibold">Health</h2>
          <dl className="mt-5 divide-y divide-[var(--color-border)]">
            {healthTesting.tests.map((test) => <div key={test.testCode} className="grid gap-1 py-4 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1fr)] sm:gap-5"><dt className="theme-copy text-sm">{test.displayName}</dt><dd><div className={`text-sm font-semibold ${test.severityKey ? PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES[test.severityKey] : "theme-heading"}`}>{test.resultLabel ?? "Not tested"}</div><div className="theme-copy mt-1 text-xs leading-5">{test.testedDateLabel ?? test.minimumAgeLabel}</div></dd></div>)}
            {healthTesting.breedingSafetyScreening.map((screening) => <div key={screening.screeningCode} className="grid gap-1 py-4 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1fr)] sm:gap-5"><dt className="theme-copy text-sm">{screening.label}</dt><dd><div className="theme-heading text-sm font-semibold">{screening.currentStatusLabel}</div><div className="theme-copy mt-1 text-xs leading-5">{screening.validUntilLabel ?? screening.testedAtLabel ?? screening.helperText}</div></dd></div>)}
          </dl>
          {healthActions}
        </section>

        <section className="border-t border-[var(--color-border)] py-8" aria-labelledby="show-career-heading">
          <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">{titlesAndShowCareer.summaryLabel}</p>
          <h2 id="show-career-heading" className="theme-heading mt-2 text-2xl font-semibold">Show Career</h2>
          <dl className="mt-5 divide-y divide-[var(--color-border)]"><div className="py-4"><dt className="theme-copy text-sm">Champion progress</dt><dd className="theme-heading text-sm font-semibold">{titlesAndShowCareer.pointsEarned}/{titlesAndShowCareer.pointsRequired} points · {titlesAndShowCareer.majorsEarned}/{titlesAndShowCareer.majorsRequired} majors</dd></div><div className="py-4"><dt className="theme-copy text-sm">Grand Champion progress</dt><dd className="theme-heading text-sm font-semibold">{titlesAndShowCareer.grandPointsLabel} · {titlesAndShowCareer.grandMajorsEarned}/{titlesAndShowCareer.grandMajorsRequired} majors</dd></div><div className="py-4"><dt className="theme-copy text-sm">Latest result</dt><dd className="theme-heading text-sm font-semibold">{titlesAndShowCareer.recentShowResults[0]?.showName ?? "No completed show results yet."}</dd></div></dl>
          {invitationalHonors.length > 0 ? <div className="mt-5 border-t border-[var(--color-border)] pt-5"><h3 className="theme-heading text-sm font-semibold">Invitational Honors</h3><div className="mt-3 flex flex-wrap gap-2">{invitationalHonors.map((badge) => badge.href ? <Link key={badge.code} href={badge.href} className="theme-secondary-button rounded-full px-3 py-1.5 text-xs font-semibold">{badge.label}</Link> : <span key={badge.code} className="dog-neutral-badge rounded-full px-3 py-1.5 text-xs font-semibold">{badge.label}</span>)}</div></div> : null}
          <div className="mt-5 flex flex-wrap gap-2"><Link href={titlesAndShowCareer.fullShowRecordUrl} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">View Full Show Record</Link><Link href={`/dogs/${header.dogId}/ribbon-room`} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Ribbon Room</Link></div>
        </section>

        <section className="border-t border-[var(--color-border)] py-8" aria-labelledby="pedigree-heading">
          <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">{pedigree.healthTestsSummary}</p>
          <h2 id="pedigree-heading" className="theme-heading mt-2 text-2xl font-semibold">Pedigree</h2>
          <p className="theme-copy mt-4 text-sm leading-6">{pedigree.coiLabel} · {snapshot.originLabel}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{pedigree.ancestors.slice(0, 4).map((dog) => <Link key={dog.dogId} href={dog.profileUrl} className="dog-card rounded-xl px-4 py-3 text-sm"><span className="theme-heading font-semibold">{dog.relationship}: {dog.displayName}</span><span className="theme-copy mt-1 block text-xs">{dog.healthTestsSummary}</span></Link>)}</div>
          <Link href={`/dogs/${header.dogId}/pedigree`} className="theme-secondary-button mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold">View Full Pedigree</Link>
        </section>

        <section className="border-t border-[var(--color-border)] py-8" aria-labelledby="breeding-heading">
          <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">{breedingAndProduction.productionRoleLabel}</p>
          <h2 id="breeding-heading" className="theme-heading mt-2 text-2xl font-semibold">Breeding &amp; Production</h2>
          <div className="mt-4"><p className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">Current reproductive status</p><p className="theme-heading mt-1 text-sm font-semibold">{reproductiveStatusLabel}</p>{reproductiveStatusDetail ? <p className="theme-copy mt-1 text-sm leading-6">{reproductiveStatusDetail}</p> : null}{snapshot.breedingAvailabilityLabel ? <p className="theme-copy mt-1 text-sm leading-6">{snapshot.breedingAvailabilityLabel}</p> : null}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="dog-card rounded-xl p-4 text-sm"><div className="theme-copy">Producer merit</div><div className="theme-heading mt-1 font-semibold">{breedingAndProduction.producerMerit.progressLabel}</div></div><div className="dog-card rounded-xl p-4 text-sm"><div className="theme-copy">Champion offspring</div><div className="theme-heading mt-1 font-semibold">{breedingAndProduction.championOffspringCount}</div></div></div>
          {hasBreedingHistory ? <div className="mt-5 border-t border-[var(--color-border)] pt-5"><h3 className="theme-heading text-sm font-semibold">Breeding History</h3><p className="theme-copy mt-1 text-sm">Previous breeding partners</p><div className="mt-3 grid gap-2">{breedingAndProduction.damHistory.map((attempt) => <div key={attempt.attemptId} className="dog-card rounded-xl p-3 text-sm"><span className="theme-copy">Bred to </span><Link href={attempt.sireUrl} className="theme-heading font-semibold underline">{attempt.sireName}</Link><span className="theme-copy"> · {attempt.breedingDateLabel} · {attempt.attemptStatusLabel}</span>{attempt.litterUrl ? <div className="mt-1"><Link href={attempt.litterUrl} className="theme-heading text-xs font-semibold underline">View litter</Link>{attempt.puppyCount !== null ? <span className="theme-copy text-xs"> · {attempt.puppyCount} puppies, {attempt.survivedCount ?? 0} survived</span> : null}</div> : null}</div>)}{breedingAndProduction.sireHistory.map((attempt) => <div key={attempt.attemptId} className="dog-card rounded-xl p-3 text-sm"><span className="theme-copy">{attempt.usingKennelName} bred to </span><Link href={attempt.damUrl} className="theme-heading font-semibold underline">{attempt.damName}</Link><span className="theme-copy"> · {attempt.dateUsedLabel} · {attempt.attemptStatusLabel}</span>{attempt.litterUrl ? <div className="mt-1"><Link href={attempt.litterUrl} className="theme-heading text-xs font-semibold underline">View litter</Link></div> : null}</div>)}</div></div> : null}
          {breedingAndProduction.progeny.length ? <div className="mt-4 grid gap-2">{breedingAndProduction.progeny.map((dog) => <Link key={dog.dogId} href={dog.dogUrl} className="theme-copy text-sm underline">{dog.displayName} · {dog.sexLabel}</Link>)}</div> : null}
          {privatePlanning}
        </section>
      </div>
    </div>
  );
}
