import type { Metadata } from "next";
import Link from "next/link";

import TraitLine from "@/components/ui/TraitLine";
import { exampleDog, exampleVisibleCategories } from "../exampleDogData";

export const metadata: Metadata = {
  title: `${exampleDog.regNumber} Example Dog | ShowRing Game`,
  description:
    "A static example dog page for learning how visible categories, snapshot details, and profile actions work in ShowRing.",
};

const snapshotFacts = [
  ["Registration number", exampleDog.regNumber],
  ["Breed", exampleDog.breedName],
  ["Sex", exampleDog.sexLabel],
  ["Age", exampleDog.ageLabel],
  ["Origin", exampleDog.originLabel],
  ["Lifecycle", exampleDog.lifecycleLabel],
  ["Market", exampleDog.marketLabel],
  ["Show", exampleDog.showEligibilityLabel],
  ["Breeding", exampleDog.breedingEligibilityLabel],
];

const learningNotes = [
  "This is a static guide example, not a live dog owned by a player.",
  "The sliders match the display style used on real dog pages.",
  "Values near 10 are close to ideal for most visible ring categories.",
  "Conditioning & Handling uses a 0-10 scale where 10 is optimized.",
];

export default function ExampleDogPage() {
  return (
    <main className="dog-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="dog-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-[var(--dog-border)] bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
                Example Dog Page
              </div>
              <div className="text-sm font-medium text-[var(--dog-label)]">
                {exampleDog.breedName}
              </div>
              <h1 className="dog-heading mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {exampleDog.registeredName}
              </h1>
              <p className="dog-copy mt-4 max-w-3xl text-sm leading-7">
                Use this sample dog to learn what a profile is showing before
                you open one of your own dogs. Real dog pages include more live
                controls, records, health details, pedigree, and owner-only
                planning tools.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <Link
                href="/guide"
                className="dog-secondary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
              >
                Back to Guide
              </Link>
              <Link
                href="/market"
                className="rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                Browse Market
              </Link>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-6">
          <section className="dog-panel rounded-[28px] p-6 lg:col-span-2">
            <h2 className="dog-heading text-xl font-semibold">Snapshot</h2>
            <p className="dog-copy mt-2 text-sm leading-6">
              Identity and current state at a glance.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {snapshotFacts.map(([label, value]) => (
                <div key={label} className="dog-card rounded-xl px-3 py-2">
                  <div className="dog-label text-[10px] uppercase tracking-wide">
                    {label}
                  </div>
                  <div className="dog-heading mt-0.5 text-sm font-semibold">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="dog-panel rounded-[28px] p-6 lg:col-span-4">
            <h2 className="dog-heading text-xl font-semibold">
              Quality & Presentation
            </h2>
            <p className="dog-copy mt-2 text-sm leading-6">
              Most public ring categories are 0-20 directional with 10 ideal.
              Conditioning & Handling is 0-10 with 10 optimized.
            </p>
            <div className="mt-6 grid gap-x-8 gap-y-5 lg:grid-cols-2">
              {exampleVisibleCategories.map((category) => (
                <TraitLine
                  key={category.key}
                  label={category.label}
                  value={category.numericScore}
                  min={category.min}
                  max={category.max}
                  ideal={category.ideal}
                  leftLabel={category.leftLabel}
                  centerLabel={category.centerLabel}
                  rightLabel={category.rightLabel}
                />
              ))}
            </div>
          </section>

          <section className="dog-panel rounded-[28px] p-6 lg:col-span-6">
            <h2 className="dog-heading text-xl font-semibold">
              What to notice
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {learningNotes.map((note) => (
                <div
                  key={note}
                  className="dog-card rounded-2xl px-4 py-3 text-sm leading-6 text-[var(--dog-copy)]"
                >
                  {note}
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
