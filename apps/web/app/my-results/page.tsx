import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAwardPoints(points: number): string {
  return `${points} pt${points === 1 ? "" : "s"}`;
}

type MyShowResultEntry = {
  entryStatus: string;
  showResult: {
    pointsAwarded: number;
    isMajor: boolean;
    showAwards: Array<{
      awardCode: string;
      pointsAwarded: number;
      isMajor: boolean;
    }>;
  } | null;
};

function formatResult(entry: MyShowResultEntry): string {
  if (!entry.showResult) {
    if (entry.entryStatus === "INELIGIBLE") return "Ineligible";
    if (entry.entryStatus === "JUDGED") return "DNP";
    return "Pending";
  }

  const awards = entry.showResult.showAwards.length > 0
    ? entry.showResult.showAwards
    : [];

  if (awards.length === 0) {
    return "DNP";
  }

  return awards.map((award) => award.awardCode).join(", ");
}

function formatPointsAwarded(entry: MyShowResultEntry): string | null {
  const pointsAwarded = entry.showResult?.pointsAwarded ?? 0;

  if (pointsAwarded <= 0) {
    return null;
  }

  return `${formatAwardPoints(pointsAwarded)}${
    entry.showResult?.isMajor ? " major" : ""
  }`;
}

export default async function MyShowResultsPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { id: true, name: true },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const entries = await db.showEntry.findMany({
    where: {
      kennelId: kennel.id,
      showResult: {
        isNot: null,
      },
    },
    orderBy: [
      { showDay: { scheduledEpoch: "desc" } },
      { dog: { registeredName: "asc" } },
      { dog: { regNumber: "asc" } },
    ],
    take: 100,
    select: {
      id: true,
      entryStatus: true,
      dog: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
        },
      },
      breed: { select: { name: true, code2: true } },
      showDay: {
        select: {
          dayIndex: true,
          scheduledEpoch: true,
          cluster: {
            select: {
              id: true,
              name: true,
              district: true,
            },
          },
        },
      },
      showResult: {
        select: {
          pointsAwarded: true,
          isMajor: true,
          showAwards: {
            orderBy: [{ awardGroup: "asc" }, { rank: "asc" }],
            select: {
              awardCode: true,
              pointsAwarded: true,
              isMajor: true,
            },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              My Show Results
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
              The latest 100 judged show results for dogs in {kennel.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="rounded-2xl border border-sky-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-white/10"
            >
              Show Calendar
            </Link>
            <Link
              href="/kennel"
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              My Kennel
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/75">
            No judged show results yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                  <th className="px-3 py-2">Dog</th>
                  <th className="px-3 py-2">Show</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Breed</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Points</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const pointsAwarded = formatPointsAwarded(entry);

                  return (
                    <tr
                      key={entry.id}
                      className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                    >
                      <td className="rounded-l-2xl px-3 py-3">
                        <Link
                          href={`/dogs/${entry.dog.id}`}
                          className="font-semibold text-white underline-offset-4 hover:underline"
                        >
                          {formatDogDisplayName(entry.dog)}
                        </Link>
                        <div className="text-xs text-purple-100/55">
                          {entry.dog.regNumber}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/shows/${entry.showDay.cluster.id}/results`}
                          className="font-semibold text-white underline-offset-4 hover:underline"
                        >
                          {entry.showDay.cluster.name}
                        </Link>
                        <div className="text-xs text-purple-100/55">
                          District {entry.showDay.cluster.district}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-purple-100/80">
                        {formatShowDate(entry.showDay.scheduledEpoch)}
                        <div className="text-xs text-purple-100/55">
                          Day {entry.showDay.dayIndex}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-purple-100/80">
                        {entry.breed.name} ({entry.breed.code2})
                      </td>
                      <td className="px-3 py-3 font-semibold text-white">
                        {formatResult(entry)}
                      </td>
                      <td className="rounded-r-2xl px-3 py-3 font-semibold text-white">
                        {pointsAwarded ?? (
                          <span className="text-purple-100/35">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
