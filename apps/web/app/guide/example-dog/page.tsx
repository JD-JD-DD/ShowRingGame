import type { Metadata } from "next";
import Link from "next/link";

import DogProfileDashboard from "@/components/dogs/DogProfileDashboard";
import HealthClearBadge from "@/components/dogs/HealthClearBadge";
import {
  exampleCurrentEpoch,
  exampleDogProfile,
} from "../exampleDogData";

export const metadata: Metadata = {
  title: `${exampleDogProfile.header.regNumber} Example Dog | ShowRing Game`,
  description:
    "A static example dog profile showing the same health, breeding, pedigree, show career, and presentation sections used by real ShowRing dog pages.",
};

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
      return "border-[var(--dog-border)] bg-purple-500/10 text-[var(--dog-heading)]";
  }
}

export default function ExampleDogPage() {
  const profile = exampleDogProfile;
  const { header } = profile;
  const headerDisplayName = [
    header.visibleTitlePrefix,
    header.registeredName ?? header.callName ?? header.displayName,
    header.visibleTitleSuffix,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="dog-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="dog-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="max-w-4xl">
              <div className="mb-3 inline-flex rounded-full border border-[var(--dog-border)] bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
                Show Profile
              </div>
              <div className="text-sm font-medium text-[var(--dog-label)]">
                {header.breedName}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="dog-heading text-4xl font-bold tracking-tight sm:text-5xl">
                  {headerDisplayName}
                </h1>
                {profile.snapshot.healthTestingSummary.badgeStatus ? (
                  <HealthClearBadge
                    status={profile.snapshot.healthTestingSummary.badgeStatus}
                    fullClearance={
                      profile.snapshot.healthTestingSummary.hasFullClearance
                    }
                    size="lg"
                  />
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {header.badges.map((badge) => (
                  <span
                    key={badge.code}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(badge.tone)}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <Link
                href="/start-up-guide"
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

        <DogProfileDashboard
          profile={profile}
          currentEpoch={exampleCurrentEpoch}
          healthMessage={null}
          healthError={null}
          notesMessage={null}
          notesError={null}
          showMessage={null}
          showError={null}
        />
      </div>
    </main>
  );
}
