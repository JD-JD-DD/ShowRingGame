"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES } from "@/components/dogs/phenotypeHealthPresentation";
import TraitLine from "@/components/ui/TraitLine";

import { prototypeDog } from "./fixture";

export default function DogProfileDesignPrototypePage() {
  const [hasArtwork, setHasArtwork] = useState(true);
  const [showUrgentCare, setShowUrgentCare] = useState(true);
  const [manageDogOpen, setManageDogOpen] = useState(false);
  const [prototypeNotice, setPrototypeNotice] = useState<string | null>(null);
  const dog = prototypeDog;

  return (
    <main className="dog-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div>
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Dog Profile Preview</p>
            <h1 className="theme-heading mt-1 text-xl font-semibold">Upcoming Dog Profile</h1>
          </div>
          <button
            type="button"
            aria-pressed={hasArtwork}
            onClick={() => setHasArtwork((current) => !current)}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {hasArtwork ? "View Without Breed Art" : "View With Breed Art"}
          </button>
        </div>

        <p className="theme-copy mb-6 text-sm leading-6">This is a preview of the upcoming Individual Dog Profile using a sample dog. Buttons and statuses on this page are examples only and do not affect the game.</p>

        {showUrgentCare ? (
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
        ) : (
          <button type="button" onClick={() => setShowUrgentCare(true)} className="theme-secondary-button mb-6 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Preview Emergency State</button>
        )}

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
            <p className="theme-label text-sm font-semibold uppercase tracking-[0.18em]">{dog.breed} · {dog.sex}</p>
            <h2 className="theme-heading mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{dog.titlePrefix} {dog.registeredName}</h2>
            <p className="theme-copy mt-3 text-xl">“{dog.callName}”</p>
            <p className="theme-copy mt-5 text-sm leading-7">{dog.lifecycle}</p>
            <div className="relative mt-6 flex flex-wrap gap-3">
              <PrototypeButton label="Enter Show" onActivate={setPrototypeNotice} primary />
              <button type="button" aria-expanded={manageDogOpen} aria-controls="manage-dog-panel" onClick={() => setManageDogOpen((current) => !current)} className="theme-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Manage Dog</button>
              {manageDogOpen ? (
                <section id="manage-dog-panel" aria-label="Manage Dog prototype controls" className="theme-panel basis-full rounded-2xl p-5 lg:absolute lg:right-0 lg:top-full lg:z-10 lg:mt-3 lg:w-[min(42rem,calc(100vw-3rem))]">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Administrative actions</p><h2 className="theme-heading mt-1 text-xl font-semibold">Manage Aster</h2></div>
                    <button type="button" onClick={() => setManageDogOpen(false)} className="theme-secondary-button rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Close</button>
                  </div>
                  <div className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2">
                    <ManageActionGroup title="Identity" actions={["Edit call name", "Register name"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Kennel" actions={["Move to another run", "Re-home"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Care" actions={["Groom"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Breeding" actions={["Breeding participation"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Market" actions={["List for sale", "Manage listing"]} onActivate={setPrototypeNotice} />
                    <ManageActionGroup title="Private" actions={["Notes"]} onActivate={setPrototypeNotice} />
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
          <div className="mt-8"><PrototypeButton label="Groom Aster" onActivate={setPrototypeNotice} /></div>
        </section>

        <div className="grid gap-x-12 border-t border-[var(--color-border)] py-12 lg:grid-cols-2">
          <SummarySection title="Health" eyebrow={dog.healthSummary} rows={dog.healthResults.map(([name, status, detail, severity]) => ({ name, value: status, detail, valueClassName: PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES[severity] }))} action={<PrototypeButton label="Order Health Tests" onActivate={setPrototypeNotice} />} />
          <SummarySection title="Show Career" eyebrow="A finished Champion beginning her GCH record" rows={dog.showCareer.map(([name, value, detail]) => ({ name, value, detail }))} action={<PrototypeButton label="View Full Show Record" onActivate={setPrototypeNotice} />} />
          <SummarySection title="Pedigree" eyebrow="Four generations recorded" rows={dog.pedigree.map(([name, value, detail]) => ({ name, value, detail }))} action={<PrototypeButton label="View Full Pedigree" onActivate={setPrototypeNotice} />} />
          <SummarySection title="Breeding & Production" eyebrow="Current program context" rows={dog.production.map(([name, value]) => ({ name, value }))} action={<div><button type="button" disabled aria-describedby="breed-aster-reason" className="dog-card rounded-xl px-4 py-2 text-sm font-semibold opacity-70">Breed Aster</button><p id="breed-aster-reason" className="theme-copy mt-2 text-sm leading-6">Not currently eligible — reproductive recovery is still active.</p></div>} />
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
