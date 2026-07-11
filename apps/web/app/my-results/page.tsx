import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { formatShowAwardLabels } from "@/lib/showAwards";
import { formatShowEntryAbsenceReason } from "@/lib/showEntryAbsence";
import {
  buildTitlePointsDisplay,
  formatTitlePointsDisplay,
  type TitlePointsDisplay,
} from "@/lib/titlePoints";
import type { ShowEntryAbsenceReason } from "@prisma/client";
import { getShowDistrictRegionName } from "@showring/rules";

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildShowHeaderDetails(entry: {
  showDay: {
    dayIndex: number | null;
    scheduledEpoch: number;
    cluster: {
      district: number | null;
    };
  };
}): string[] {
  const details = [`Date ${formatShowDate(entry.showDay.scheduledEpoch)}`];

  if (entry.showDay.dayIndex != null) {
    details.push(`Day ${entry.showDay.dayIndex}`);
  }

  if (entry.showDay.cluster.district != null) {
    details.push(getShowDistrictRegionName(entry.showDay.cluster.district));
  }

  return details;
}

type MyShowResultEntry = {
  entryStatus: string;
  absenceReason: ShowEntryAbsenceReason | null;
  showResult: {
    pointsAwarded: number;
    isMajor: boolean;
    showAwards: Array<{
      awardCode: string;
      pointsAwarded: number;
      isMajor: boolean;
      grandChampionCredit: {
        pointsAwarded: number;
        isMajor: boolean;
      } | null;
    }>;
  } | null;
};

function getAbsenceReasonMessage(entry: MyShowResultEntry): string | null {
  if (entry.entryStatus !== "ABSENT") {
    return null;
  }

  return formatShowEntryAbsenceReason(entry.absenceReason);
}

function formatResult(entry: MyShowResultEntry): string {
  if (!entry.showResult) {
    if (entry.entryStatus === "ABSENT") return "Absent";
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

  return formatShowAwardLabels(awards.map((award) => award.awardCode));
}

function getTitlePointsDisplay(entry: MyShowResultEntry): TitlePointsDisplay {
  if (!entry.showResult) {
    return buildTitlePointsDisplay({
      championshipPointsAwarded: 0,
      isChampionshipMajor: false,
      grandChampionCredits: [],
    });
  }

  return buildTitlePointsDisplay({
    championshipPointsAwarded: entry.showResult.pointsAwarded,
    isChampionshipMajor: entry.showResult.isMajor,
    grandChampionCredits: entry.showResult.showAwards.flatMap((award) =>
      award.grandChampionCredit ? [award.grandChampionCredit] : []
    ),
  });
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
      OR: [
        {
          showResult: {
            isNot: null,
          },
        },
        {
          entryStatus: "ABSENT",
          showDay: {
            scheduledEpoch: {
              lte: getCurrentEpoch(),
            },
          },
        },
      ],
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
      absenceReason: true,
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
              grandChampionCredit: {
                select: {
                  pointsAwarded: true,
                  isMajor: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="results-page mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="theme-heading text-4xl font-bold tracking-tight">
              My Show Results
            </h1>
            <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
              The latest 100 judged show results and absences for dogs in{" "}
              {kennel.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
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

      <section className="theme-panel rounded-[28px] p-6">
        {entries.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl p-4 text-sm">
            No judged show results yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="theme-label text-left text-xs uppercase tracking-[0.16em]">
                  <th className="px-3 py-2">Dog</th>
                  <th className="px-3 py-2">Show</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Breed</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Title Points</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const previousEntry = index > 0 ? entries[index - 1] : null;
                  const startsNewShowGroup =
                    previousEntry?.showDay.cluster.id !== entry.showDay.cluster.id;
                  const titlePointsAwarded = formatTitlePointsDisplay(
                    getTitlePointsDisplay(entry)
                  );
                  const absenceReasonMessage = getAbsenceReasonMessage(entry);
                  const showHeaderDetails = buildShowHeaderDetails(entry);

                  return (
                    <Fragment key={entry.id}>
                      {startsNewShowGroup ? (
                        <tr>
                          <td
                            colSpan={6}
                            className={`px-0 ${index === 0 ? "pt-0" : "pt-4"}`}
                          >
                            <div className={`border-t border-white/10 ${index === 0 ? "pt-0" : "pt-3"}`}>
                              <h2 className="theme-heading text-sm font-semibold sm:text-base">
                                {entry.showDay.cluster.name}
                              </h2>
                              <p className="theme-copy mt-1 text-xs sm:text-sm">
                                {showHeaderDetails.join(" | ")}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      <tr className="theme-card">
                        <td className="rounded-l-2xl px-3 py-3">
                          <Link
                            href={`/dogs/${entry.dog.id}`}
                            className="theme-heading font-semibold underline-offset-4 hover:underline"
                          >
                            {formatDogDisplayName(entry.dog)}
                          </Link>
                          <div className="theme-copy text-xs">
                            {entry.dog.regNumber}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/shows/${entry.showDay.cluster.id}/results`}
                            className="theme-heading font-semibold underline-offset-4 hover:underline"
                          >
                            {entry.showDay.cluster.name}
                          </Link>
                          <div className="theme-copy text-xs">
                            {getShowDistrictRegionName(
                              entry.showDay.cluster.district
                            )}
                          </div>
                        </td>
                        <td className="theme-copy px-3 py-3">
                          {formatShowDate(entry.showDay.scheduledEpoch)}
                          <div className="theme-copy text-xs">
                            Day {entry.showDay.dayIndex}
                          </div>
                        </td>
                        <td className="theme-copy px-3 py-3">
                          {entry.breed.name} ({entry.breed.code2})
                        </td>
                        <td className="theme-heading px-3 py-3 font-semibold">
                          {formatResult(entry)}
                          {absenceReasonMessage ? (
                            <div className="theme-copy mt-1 text-xs font-normal">
                              {absenceReasonMessage}
                            </div>
                          ) : null}
                        </td>
                        <td className="theme-heading rounded-r-2xl px-3 py-3 font-semibold">
                          {titlePointsAwarded ?? (
                            <span className="theme-copy opacity-50">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    </Fragment>
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
