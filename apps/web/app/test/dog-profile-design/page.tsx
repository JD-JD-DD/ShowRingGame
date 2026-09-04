"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES } from "@/components/dogs/phenotypeHealthPresentation";
import TraitLine from "@/components/ui/TraitLine";

import { prototypeCurrentShowEntries, prototypeDog, prototypeKennelRunNavigation } from "./fixture";

type PrototypeView = "owner" | "public" | "listed" | "stud" | "deceased" | "pregnant";

export default function DogProfileDesignPrototypePage() {
  const [hasArtwork, setHasArtwork] = useState(true);
  const [showUrgentCare, setShowUrgentCare] = useState(true);
  const [manageDogOpen, setManageDogOpen] = useState(false);
  const [showEntriesOpen, setShowEntriesOpen] = useState(false);
  const [groomingOpen, setGroomingOpen] = useState(false);
  const [outsideGroomingListed, setOutsideGroomingListed] = useState(false);
  const [prototypeView, setPrototypeView] = useState<PrototypeView>("owner");
  const [prototypeNotice, setPrototypeNotice] = useState<string | null>(null);
  const dog = prototypeDog;
  const isOwner = prototypeView === "owner" || prototypeView === "pregnant";
  const isDeceased = prototypeView === "deceased";
  const isPregnant = prototypeView === "pregnant";
  const canBuyDog = prototypeView === "listed";
  const canUseAtStud = prototypeView === "stud";
  const heroStatus = isDeceased ? "Deceased · Age at death 4y 2w" : isPregnant ? "Alive · Pregnant · Show restricted" : dog.lifecycle;

  return (
    <main className="dog-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div>
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Dog Profile Preview</p>
            <h1 className="theme-heading mt-1 text-xl font-semibold">Upcoming Dog Profile</h1>
          </div>
          <div className="flex flex-wrap items-end gap-3"><label className="theme-label grid gap-1 text-xs font-semibold uppercase tracking-[0.14em]">Preview state<select value={prototypeView} onChange={(event) => setPrototypeView(event.target.value as PrototypeView)} className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold normal-case tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><option value="owner">Owner</option><option value="public">Public</option><option value="listed">Public · Listed</option><option value="stud">Public · At Stud</option><option value="deceased">Deceased</option><option value="pregnant">Owner · Pregnant</option></select></label><button
            type="button"
            aria-pressed={hasArtwork}
            onClick={() => setHasArtwork((current) => !current)}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {hasArtwork ? "View Without Breed Art" : "View With Breed Art"}
          </button></div>
        </div>

        <p className="theme-copy mb-6 text-sm leading-6">This is a preview of the upcoming Individual Dog Profile using a sample dog. Buttons and statuses on this page are examples only and do not affect the game.</p>

        {isOwner && showUrgentCare ? (
          <section className="mb-6 border-l-4 border-[var(--color-danger)] bg-[var(--color-danger-surface)] px-5 py-4" aria-labelledby="prototype-urgent-care-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Prototype urgent state</p>
                <h2 id="prototype-urgent-care-heading" className="theme-heading mt-1 text-lg font-semibold">Emergency veterinary care required</h2>
                <p className="theme-copy mt-1 text-sm leading-6">Aster needs a time-sensitive care decision. This is a static design example only.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PrototypeButton label="Review Care" onActivate={setPrototypeNotice} />
                <button type="button" onClick={() => setShowUrgentCare(false)} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Hide Emergency Preview</button>
              </div>
            </div>
          </section>
        ) : isOwner ? (
          <button type="button" onClick={() => setShowUrgentCare(true)} className="theme-secondary-button mb-6 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Preview Emergency State</button>
        ) : null}

        {isOwner ? <nav aria-label="Kennel run dog navigation" className="theme-card mb-6 grid gap-2 rounded-2xl p-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch"><div className="theme-card-interactive flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-sm font-semibold"><span>← Previous Dog</span><span className="theme-copy mt-0.5 text-xs font-medium">Previous: {prototypeKennelRunNavigation.previous}</span></div><div className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-inset)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{prototypeKennelRunNavigation.position}</div><div className="theme-card-interactive flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-sm font-semibold sm:text-right"><span>Next Dog →</span><span className="theme-copy mt-0.5 text-xs font-medium">Next: {prototypeKennelRunNavigation.next}</span></div></nav> : null}

        <section className="grid gap-8 border-b border-[var(--color-border)] pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="order-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[var(--color-surface-inset)]">
              {hasArtwork ? (
                <Image src="/prototype-assets/dachshund-aster-prototype.png" alt="Prototype Dachshund breed artwork for Aster" fill priority className="object-cover" sizes="(min-width: 1024px) 48vw, 100vw" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Breed Art collection</p>
                  <h2 className="theme-heading mt-3 text-3xl font-semibold">Want Breed Art?</h2>
                  <p className="theme-copy mt-3 max-w-sm text-sm leading-6">Help fund future original artwork for this breed. This prototype does not represent a funding status.</p>
                  <Link href="/breed-art" className="theme-primary-button mt-6 rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Explore Breed Art</Link>
                </div>
              )}
            </div>
          </div>

          <div className="order-2 max-w-2xl">
            <p className="theme-label text-sm font-semibold uppercase tracking-[0.18em]">{dog.breed} · COLOR · {dog.sex}</p>
            <h2 className="theme-heading mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{dog.titlePrefix} {dog.registeredName}</h2>
            <p className="theme-copy mt-3 text-xl">“{dog.callName}”</p>
            <p className={`theme-copy mt-5 text-sm leading-7 ${isDeceased || isPregnant ? "font-semibold" : ""}`}>{heroStatus}</p>
            <div className="relative mt-6 flex flex-wrap gap-3">
              {!isDeceased && isOwner ? <><PrototypeButton label="Show Planner" onActivate={setPrototypeNotice} primary /><button type="button" aria-expanded={manageDogOpen} aria-controls="manage-dog-panel" onClick={() => setManageDogOpen((current) => !current)} className="theme-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Manage Dog</button></> : null}
              {!isDeceased && canBuyDog ? <PrototypeButton label="Buy Dog" onActivate={setPrototypeNotice} primary /> : null}
              {!isDeceased && canUseAtStud ? <PrototypeButton label="Use at Stud" onActivate={setPrototypeNotice} primary /> : null}
              {isOwner && manageDogOpen ? (
                <section id="manage-dog-panel" aria-label="Manage Dog prototype controls" className="theme-panel basis-full rounded-2xl p-5 lg:absolute lg:right-0 lg:top-full lg:z-10 lg:mt-3 lg:w-[min(42rem,calc(100vw-3rem))]">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Administrative actions</p><h2 className="theme-heading mt-1 text-xl font-semibold">Manage Aster</h2></div>
                    <button type="button" onClick={() => setManageDogOpen(false)} className="theme-secondary-button rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Close</button>
                  </div>
                  <div className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2">
                    <ManageActionGroup title="Identity" actions={["Edit call name", "Register name"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Kennel" actions={["Move to another run", "Re-home"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Breeding" actions={["Breed", "Breeding participation"]} onActivate={setPrototypeNotice} />
                    <ManageGroomingGroup isOpen={groomingOpen} isListed={outsideGroomingListed} onToggle={() => setGroomingOpen((current) => !current)} onSetListed={setOutsideGroomingListed} onActivate={setPrototypeNotice} />
                    <div className="sm:col-span-2"><ManageShowsGroup entries={prototypeCurrentShowEntries} isOpen={showEntriesOpen} onToggle={() => setShowEntriesOpen((current) => !current)} onPull={setPrototypeNotice} /></div>
                    <ManageActionGroup title="Stud" actions={["Stud Worksheet"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Market" actions={["List for sale", "Manage listing"]} onActivate={setPrototypeNotice} />
                  </div>
                </section>
              ) : null}
            </div>
            <dl className="mt-8 grid gap-x-8 gap-y-5 border-y border-[var(--color-border)] py-6 sm:grid-cols-2">
              <Fact label="Registration" value={dog.registrationNumber} />
              <Fact label="Game age" value={dog.age} />
              <Fact label="Owner" value={dog.owner} />
              <Fact label="Breeder" value={dog.breeder} />
              <Fact label="Kennel Run" value={dog.kennelRun} />
              <Fact label="Health" value={dog.healthSummary} />
            </dl>
          </div>
        </section>

        <section className="py-12" aria-labelledby="evaluation-heading">
          <div className="max-w-3xl">
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Ring evaluation</p>
            <h2 id="evaluation-heading" className="theme-heading mt-2 text-3xl font-semibold">Conformation & presentation</h2>
            <p className="theme-copy mt-3 text-sm leading-7">Visible ring categories retain ShowRing’s directional dog sliders and precise player-facing values.</p>
          </div>
          <div className="mt-9 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            {dog.visibleCategories.map((category) => (
              <TraitLine key={category.key} label={category.label} value={category.value} min={category.min} max={category.max} ideal={category.ideal} leftLabel={category.leftLabel} centerLabel={category.centerLabel} rightLabel={category.rightLabel} precision={3} />
            ))}
          </div>
        </section>

        <div className="grid gap-x-12 border-t border-[var(--color-border)] py-12 lg:grid-cols-2">
          <SummarySection title="Health" eyebrow={dog.healthSummary} rows={dog.healthResults.map(([name, status, detail, severity]) => ({ name, value: status, detail, valueClassName: PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES[severity] }))} action={isOwner ? <PrototypeButton label="Order Health Tests" onActivate={setPrototypeNotice} /> : null} />
          <SummarySection title="Show Career" eyebrow="A finished Champion beginning her GCH record" rows={dog.showCareer.map(([name, value, detail]) => ({ name, value, detail }))} action={<div className="flex flex-wrap gap-2"><PrototypeButton label="View Full Show Record" onActivate={setPrototypeNotice} /><PrototypeButton label="Ribbon Room" onActivate={setPrototypeNotice} /></div>} />
          <SummarySection title="Pedigree" eyebrow="Four generations recorded" rows={dog.pedigree.map(([name, value, detail]) => ({ name, value, detail }))} action={<PrototypeButton label="View Full Pedigree" onActivate={setPrototypeNotice} />} />
          <SummarySection title="Breeding & Production" eyebrow="Current program context" rows={dog.production.map(([name, value]) => ({ name, value }))} action={<div className="space-y-5"><div className="dog-card rounded-xl p-4"><h3 className="theme-heading text-sm font-semibold">Current reproductive detail</h3><p className="theme-copy mt-2 text-sm leading-6">{isPregnant ? "Pregnant. Show participation is restricted while this fictional pregnancy is active." : isDeceased ? "Historical breeding and production record preserved after death." : "Open to future breeding planning; current availability is represented in the hero status."}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="dog-card rounded-xl p-4"><h3 className="theme-heading text-sm font-semibold">Reproductive history</h3><p className="theme-copy mt-2 text-sm leading-6">Bred to Foundation Sire · Year 2, Week 8 · 4 puppies survived.</p></div><div className="dog-card rounded-xl p-4"><h3 className="theme-heading text-sm font-semibold">Progeny</h3><p className="theme-copy mt-2 text-sm leading-6">Riverlight Juniper · Female · future Champion prospect.</p></div></div>{isOwner ? <div className="border-t border-[var(--color-border)] pt-5"><h3 className="theme-heading text-sm font-semibold">Private Kennel Notes</h3><p className="theme-copy mt-2 text-sm leading-6">Program tags: holdback prospect · autumn specialty plan</p><p className="theme-copy mt-1 text-sm leading-6">Keep conditioning steady through the next show cluster.</p></div> : null}</div>} />
        </div>
        {prototypeNotice ? <p role="status" aria-live="polite" className="theme-status-info mt-2 rounded-xl px-4 py-3 text-sm">{prototypeNotice} is a prototype-only control; no Dog action was performed.</p> : null}
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">{label}</dt><dd className="theme-heading mt-1 text-base font-semibold">{value}</dd></div>;
}

function PrototypeButton({ label, onActivate, primary = false }: { label: string; onActivate: (label: string) => void; primary?: boolean }) {
  return <button type="button" onClick={() => onActivate(label)} className={`${primary ? "theme-primary-button" : "theme-secondary-button"} rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}>{label}</button>;
}

function ManageActionGroup({ title, actions, onActivate }: { title: string; actions: string[]; onActivate: (label: string) => void }) {
  return <section aria-labelledby={`manage-${title.toLowerCase()}-heading`}><h3 id={`manage-${title.toLowerCase()}-heading`} className="theme-label text-xs font-semibold uppercase tracking-[0.16em]">{title}</h3><div className="mt-2 flex flex-wrap gap-2">{actions.map((action) => <PrototypeButton key={action} label={action} onActivate={onActivate} />)}</div></section>;
}

function ManageGroomingGroup({ isOpen, isListed, onToggle, onSetListed, onActivate }: { isOpen: boolean; isListed: boolean; onToggle: () => void; onSetListed: (listed: boolean) => void; onActivate: (label: string) => void }) {
  return <section aria-labelledby="manage-grooming-heading"><h3 id="manage-grooming-heading" className="theme-label text-xs font-semibold uppercase tracking-[0.16em]">Grooming</h3><button type="button" aria-expanded={isOpen} aria-controls="prototype-grooming-management" onClick={onToggle} className="theme-secondary-button mt-2 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Manage Grooming</button>{isOpen ? <div id="prototype-grooming-management" className="dog-card mt-3 space-y-3 rounded-xl p-4 text-sm"><p className="theme-copy">Coat condition: 8.1 · 1 weekly grooming action remains.</p>{isListed ? <><p className="theme-copy">Currently listed for outside grooming.</p><PrototypeButton label="Cancel Grooming Listing" onActivate={() => { onSetListed(false); onActivate("Cancel grooming listing"); }} /></> : <><div className="flex flex-wrap gap-2"><PrototypeButton label="Self Groom" onActivate={onActivate} /><PrototypeButton label="Offer for Outside Grooming" onActivate={() => { onSetListed(true); onActivate("Offer for outside grooming"); }} /></div><p className="theme-copy text-xs leading-5">If listed for outside grooming, self grooming becomes unavailable until the listing is cancelled.</p></>}</div> : null}</section>;
}

function ManageShowsGroup({ entries, isOpen, onToggle, onPull }: { entries: typeof prototypeCurrentShowEntries; isOpen: boolean; onToggle: () => void; onPull: (label: string) => void }) {
  return <section aria-labelledby="manage-shows-heading"><h3 id="manage-shows-heading" className="theme-label text-xs font-semibold uppercase tracking-[0.16em]">Shows</h3><button type="button" aria-expanded={isOpen} aria-controls="prototype-current-entries" onClick={onToggle} className="theme-secondary-button mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Manage Shows <span className="theme-label text-xs">{entries.length} current entries</span></button>{isOpen ? <div id="prototype-current-entries" className="mt-3 grid gap-2">{entries.map((entry) => <div key={entry.id} className="dog-card flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"><div className="min-w-0 flex-1"><div className="theme-heading font-semibold">{entry.showName}</div><div className="theme-copy mt-1 text-xs">{entry.showDateLabel} · {entry.dayLabel} · {entry.district}</div></div><PrototypeButton label="Pull entry" onActivate={() => onPull(`Pull entry from ${entry.showName}`)} /></div>)}</div> : null}</section>;
}

function SummarySection({ title, eyebrow, rows, action }: { title: string; eyebrow: string; rows: Array<{ name: string; value: string; detail?: string; valueClassName?: string }>; action: React.ReactNode }) {
  return <section className="border-b border-[var(--color-border)] py-8 first:pt-0 lg:[&:nth-child(-n+2)]:pt-0" aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}>
    <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">{eyebrow}</p>
    <h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`} className="theme-heading mt-2 text-2xl font-semibold">{title}</h2>
    <dl className="mt-5 divide-y divide-[var(--color-border)]">
      {rows.map((row) => <div key={row.name} className="grid gap-1 py-4 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1fr)] sm:gap-5"><dt className="theme-copy text-sm">{row.name}</dt><dd><div className={`text-sm font-semibold ${row.valueClassName ?? "theme-heading"}`}>{row.value}</div>{row.detail ? <div className="theme-copy mt-1 text-xs leading-5">{row.detail}</div> : null}</dd></div>)}
    </dl>
    <div className="mt-5">{action}</div>
  </section>;
}
