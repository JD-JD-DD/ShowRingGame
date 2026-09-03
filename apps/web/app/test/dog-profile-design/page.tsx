"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import TraitLine from "@/components/ui/TraitLine";

import { prototypeDog } from "./fixture";

export default function DogProfileDesignPrototypePage() {
  const [hasArtwork, setHasArtwork] = useState(true);
  const dog = prototypeDog;

  return (
    <main className="dog-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div>
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Development prototype</p>
            <h1 className="theme-heading mt-1 text-xl font-semibold">Dog Profile design study</h1>
          </div>
          <button
            type="button"
            aria-pressed={hasArtwork}
            onClick={() => setHasArtwork((current) => !current)}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {hasArtwork ? "Preview missing artwork" : "Preview completed artwork"}
          </button>
        </div>

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
          <SummarySection title="Health" eyebrow={dog.healthSummary} rows={dog.healthResults.map(([name, status, detail]) => ({ name, value: status, detail }))} />
          <SummarySection title="Show Career" eyebrow="A finished Champion beginning her GCH record" rows={dog.showCareer.map(([name, value, detail]) => ({ name, value, detail }))} />
          <SummarySection title="Pedigree" eyebrow="Four generations recorded" rows={dog.pedigree.map(([name, value, detail]) => ({ name, value, detail }))} />
          <SummarySection title="Breeding & Production" eyebrow="Current program context" rows={dog.production.map(([name, value]) => ({ name, value }))} />
        </div>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="theme-label text-xs font-semibold uppercase tracking-[0.14em]">{label}</dt><dd className="theme-heading mt-1 text-base font-semibold">{value}</dd></div>;
}

function SummarySection({ title, eyebrow, rows }: { title: string; eyebrow: string; rows: Array<{ name: string; value: string; detail?: string }> }) {
  return <section className="border-b border-[var(--color-border)] py-8 first:pt-0 lg:[&:nth-child(-n+2)]:pt-0" aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}>
    <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">{eyebrow}</p>
    <h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`} className="theme-heading mt-2 text-2xl font-semibold">{title}</h2>
    <dl className="mt-5 divide-y divide-[var(--color-border)]">
      {rows.map((row) => <div key={row.name} className="grid gap-1 py-4 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1fr)] sm:gap-5"><dt className="theme-copy text-sm">{row.name}</dt><dd><div className="theme-heading text-sm font-semibold">{row.value}</div>{row.detail ? <div className="theme-copy mt-1 text-xs leading-5">{row.detail}</div> : null}</dd></div>)}
    </dl>
  </section>;
}
