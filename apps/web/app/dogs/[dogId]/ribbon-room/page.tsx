import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SHOW_YEAR_HOURS } from "@showring/rules";

import { CareerMilestones } from "@/components/awards/CareerMilestones";
import { InvitationalHistoryCard } from "@/components/awards/InvitationalHistoryCard";
import { RibbonTotalsSection } from "@/components/awards/RibbonTotalsSection";
import { RibbonRoomStatCard } from "@/components/awards/RibbonRoomStatCard";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getDogRibbonRoom } from "@/server/services/ribbonRoom.service";
import { getKennelForUser } from "@/server/services/kennel.service";

type PageProps = {
  params: Promise<{ dogId: string }>;
};

function formatRank(value: number | null): string {
  return value === null ? "\u2014" : `#${value.toLocaleString()}`;
}

function sectionHeading(title: string, description: string) {
  return (
    <div className="mb-5 sm:mb-6">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
        Ribbon Room
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--dog-copy)]">
        {description}
      </p>
    </div>
  );
}

export default async function DogRibbonRoomPage({ params }: PageProps) {
  const [{ dogId }, userId] = await Promise.all([params, getSessionUserId()]);

  if (!userId) redirect("/login");

  const currentKennel = await getKennelForUser(userId);
  if (!currentKennel) redirect("/onboarding");

  const ribbonRoom = await getDogRibbonRoom(dogId);

  if (!ribbonRoom) notFound();

  const currentYear = Math.floor(getCurrentEpoch() / SHOW_YEAR_HOURS) + 1;
  const invitationalRecords = [...ribbonRoom.invitational].sort(
    (a, b) => b.year - a.year || b.week - a.week
  );
  const noGraphicalRibbons = ribbonRoom.ribbons.length === 0;
  const registeredName =
    ribbonRoom.dog.registeredName ??
    ribbonRoom.dog.callName ??
    "Unnamed Dog";

  return (
    <main className="dog-page min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <section className="dog-panel overflow-hidden rounded-[30px] border border-white/10 px-5 py-6 shadow-[0_24px_80px_rgba(4,6,20,0.36)] backdrop-blur sm:px-7 sm:py-7">
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_70%)] pointer-events-none" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex rounded-full border border-[var(--dog-border)] bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                Ribbon Room
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-[var(--dog-label)]">
                <span>{ribbonRoom.dog.breed.name}</span>
                <span className="hidden h-1.5 w-1.5 rounded-full bg-[var(--dog-label)]/60 sm:inline-block" />
                <span>{ribbonRoom.dog.sex === "M" ? "Male" : "Female"}</span>
              </div>
              <h1 className="dog-heading mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                <Link
                  href={ribbonRoom.dog.dogPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="decoration-purple-300/60 underline-offset-4 transition hover:underline"
                >
                  {registeredName}
                </Link>
              </h1>
              {ribbonRoom.dog.callName &&
              ribbonRoom.dog.callName !== ribbonRoom.dog.registeredName ? (
                <div className="mt-3 text-base text-[var(--dog-copy)]">
                  Call name: {ribbonRoom.dog.callName}
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--dog-copy)]">
                <span className="rounded-full border border-[var(--dog-border)] bg-black/20 px-3 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  Reg. {ribbonRoom.dog.regNumber}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={ribbonRoom.dog.dogPageUrl}
                className="rounded-2xl border border-[var(--dog-border)] bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Back to Dog Page
              </Link>
              <Link
                href={ribbonRoom.dog.dogPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-purple-300/25 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-50 transition hover:bg-purple-500/20"
              >
                Open Dog Page
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:mt-10 lg:grid-cols-2">
          <article className="rounded-[28px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(7,11,28,0.38))] p-5 shadow-[var(--dog-shadow)] sm:p-6">
            {sectionHeading(
              "Champion Progress",
              "Canonical championship progress from title records."
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <RibbonRoomStatCard
                label="Points"
                value={ribbonRoom.champion.points.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Majors"
                value={ribbonRoom.champion.majors.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Distinct Judges"
                value={ribbonRoom.champion.judges.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Status"
                value={
                  ribbonRoom.champion.completed
                    ? ribbonRoom.champion.title ?? "Completed"
                    : "In Progress"
                }
              />
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(7,11,28,0.38))] p-5 shadow-[var(--dog-shadow)] sm:p-6">
            {sectionHeading(
              "Grand Champion Progress",
              "Grand Champion credits and the current earned level."
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <RibbonRoomStatCard
                label="GCH Points"
                value={ribbonRoom.grandChampion.points.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Majors"
                value={ribbonRoom.grandChampion.majors.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Distinct Judges"
                value={ribbonRoom.grandChampion.judges.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Current Level"
                value={
                  ribbonRoom.grandChampion.completed
                    ? ribbonRoom.grandChampion.level ?? "Completed"
                    : "In Progress"
                }
              />
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:mt-10 xl:grid-cols-2">
          <article className="rounded-[28px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(7,11,28,0.34))] p-5 shadow-[var(--dog-shadow)] sm:p-6">
            {sectionHeading(
              "Lifetime Statistics",
              "Career totals across every recorded year."
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <RibbonRoomStatCard
                label="Breed Dogs Beaten"
                value={ribbonRoom.lifetime.breedDogsBeaten.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Breed Rank"
                value={formatRank(ribbonRoom.lifetime.breedRank)}
                subdued={ribbonRoom.lifetime.breedRank === null}
              />
              <RibbonRoomStatCard
                label="All Dogs Beaten"
                value={ribbonRoom.lifetime.allBreedDogsBeaten.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="All-Breed Rank"
                value={formatRank(ribbonRoom.lifetime.allBreedRank)}
                subdued={ribbonRoom.lifetime.allBreedRank === null}
              />
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(7,11,28,0.34))] p-5 shadow-[var(--dog-shadow)] sm:p-6">
            {sectionHeading(
              "Current Year Statistics",
              `Year ${currentYear} standing from the current prestige rollup.`
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <RibbonRoomStatCard
                label="Breed Dogs Beaten"
                value={ribbonRoom.currentYear.breedDogsBeaten.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="Breed Rank"
                value={formatRank(ribbonRoom.currentYear.breedRank)}
                subdued={ribbonRoom.currentYear.breedRank === null}
              />
              <RibbonRoomStatCard
                label="All Dogs Beaten"
                value={ribbonRoom.currentYear.allBreedDogsBeaten.toLocaleString()}
              />
              <RibbonRoomStatCard
                label="All-Breed Rank"
                value={formatRank(ribbonRoom.currentYear.allBreedRank)}
                subdued={ribbonRoom.currentYear.allBreedRank === null}
              />
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-[28px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(7,11,28,0.36))] p-5 shadow-[var(--dog-shadow)] sm:p-6 xl:mt-10">
          {sectionHeading(
            "Ribbon Totals",
            "Graphical breed, group, and Best in Show awards."
          )}
          {noGraphicalRibbons ? (
            <div className="mb-4 rounded-2xl border border-[var(--dog-border)] bg-black/20 px-4 py-4 text-sm text-[var(--dog-copy)]">
              No BIS, group, breed, or Select awards recorded yet.
            </div>
          ) : null}
          <RibbonTotalsSection ribbons={ribbonRoom.ribbons} />
        </section>

        <section className="mt-8 rounded-[28px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(7,11,28,0.36))] p-5 shadow-[var(--dog-shadow)] sm:p-6 xl:mt-10">
          {sectionHeading(
            "Invitational Hall",
            "Only proven invitational history is shown here."
          )}
          {invitationalRecords.length === 0 ? (
            <div className="rounded-2xl border border-[var(--dog-border)] bg-black/20 px-4 py-5 text-sm text-[var(--dog-copy)]">
              No Invitational history recorded yet.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {invitationalRecords.map((record) => (
                <InvitationalHistoryCard
                  key={`${record.year}-${record.status}`}
                  record={record}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[28px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(7,11,28,0.36))] p-5 shadow-[var(--dog-shadow)] sm:p-6 xl:mt-10">
          {sectionHeading(
            "Career Milestones",
            "The key moments in this dog's show career."
          )}
          <CareerMilestones milestones={ribbonRoom.milestones} />
        </section>
      </div>
    </main>
  );
}
