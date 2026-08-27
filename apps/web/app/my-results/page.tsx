import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { formatShowAwardLabels } from "@/lib/showAwards";
import { formatShowEntryAbsenceReason } from "@/lib/showEntryAbsence";
import {
  buildTitlePointsDisplay,
  formatTitlePointsDisplay,
} from "@/lib/titlePoints";
import type { MyResultsDogResult, MyResultsHierarchy } from "./myResults.contract";
import { loadMyResultsHierarchy } from "./myResults.loader";

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatJudgeProfileUrl(judgeCode: string | null | undefined): string | null {
  return judgeCode ? `/judges/${judgeCode}` : null;
}

function renderJudgeName(args: {
  judgeName: string | null;
  judgeCode?: string | null;
}) {
  if (!args.judgeName) {
    return <span>Judge unavailable</span>;
  }

  const href = formatJudgeProfileUrl(args.judgeCode);

  if (!href) {
    return <span>{args.judgeName}</span>;
  }

  return (
    <Link
      href={href}
      className="underline-offset-4 hover:underline"
    >
      {args.judgeName}
    </Link>
  );
}

type MyResultsBreedSection = {
  breedCode2: string;
  breedName: string;
  scheduledEpoch: number;
  dayIndex: number | null;
  groupJudgeName: string | null;
  groupJudgeCode: string | null;
  bisJudgeName: string | null;
  bisJudgeCode: string | null;
  rows: MyResultsDogResult[];
};

type MyResultsCompatibilityShow = {
  clusterId: string;
  showName: string;
  districtRegionName: string;
  breedSections: MyResultsBreedSection[];
};

function getAbsenceReasonMessage(entry: MyResultsDogResult): string | null {
  if (entry.entryStatus !== "ABSENT") {
    return null;
  }

  return formatShowEntryAbsenceReason(entry.absenceReason);
}

function formatResult(entry: MyResultsDogResult): string {
  if (!entry.result) {
    if (entry.entryStatus === "ABSENT") return "Absent";
    if (entry.entryStatus === "INELIGIBLE") return "Ineligible";
    if (entry.entryStatus === "JUDGED") return "DNP";
    return "Pending";
  }

  const awards = entry.result.awardCodes;

  if (awards.length === 0) {
    return "DNP";
  }

  return formatShowAwardLabels([...awards]);
}

function getTitlePointsDisplay(entry: MyResultsDogResult) {
  if (!entry.result) {
    return buildTitlePointsDisplay({
      championshipPointsAwarded: 0,
      isChampionshipMajor: false,
      grandChampionCredits: [],
    });
  }

  return buildTitlePointsDisplay({
    championshipPointsAwarded: entry.result.championshipPointsAwarded,
    isChampionshipMajor: entry.result.isChampionshipMajor,
    grandChampionCredits: [...entry.result.grandChampionCredits],
  });
}

/** Temporary projection retaining the existing Cluster → Breed table layout. */
function buildCompatibilityShows(hierarchy: MyResultsHierarchy): MyResultsCompatibilityShow[] {
  return hierarchy.map((cluster) => {
    const breedSectionsByCode = new Map<string, MyResultsBreedSection>();

    for (const showDay of [...cluster.showDays].reverse()) {
      for (const group of showDay.groups) {
        for (const breed of group.breeds) {
          const existing = breedSectionsByCode.get(breed.code2);
          const breedSection = existing ?? {
            breedCode2: breed.code2,
            breedName: breed.name,
            scheduledEpoch: showDay.scheduledEpoch,
            dayIndex: showDay.dayIndex,
            groupJudgeName: group.judge?.judge.name ?? null,
            groupJudgeCode: group.judge?.judge.judgeCode ?? null,
            bisJudgeName: showDay.bisJudge?.name ?? null,
            bisJudgeCode: showDay.bisJudge?.judgeCode ?? null,
            rows: [],
          };
          breedSection.rows.push(...breed.dogResults);
          breedSectionsByCode.set(breed.code2, breedSection);
        }
      }
    }

    return {
      clusterId: cluster.id,
      showName: cluster.name,
      districtRegionName: cluster.districtRegionName,
      breedSections: [...breedSectionsByCode.values()].sort((left, right) =>
        left.breedName.localeCompare(right.breedName)
      ),
    };
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

  const hierarchy = await loadMyResultsHierarchy({
    kennelId: kennel.id,
    currentEpoch: getCurrentEpoch(),
  });
  const groupedShows = buildCompatibilityShows(hierarchy);
  const entryCount = hierarchy.reduce(
    (total, cluster) => total + cluster.showDays.reduce(
      (dayTotal, showDay) => dayTotal + showDay.groups.reduce(
        (groupTotal, group) => groupTotal + group.breeds.reduce(
          (breedTotal, breed) => breedTotal + breed.dogResults.length,
          0
        ),
        0
      ),
      0
    ),
    0
  );

  return (
    <main className="results-page mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="theme-heading text-4xl font-bold tracking-tight">
              My Show Results
            </h1>
            <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
              Judged show results and absences for dogs in{" "}
              {kennel.name}.
            </p>
          </div>
          </div>
      </section>

      <section className="theme-panel rounded-[28px] p-6">
        {entryCount === 0 ? (
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
                {groupedShows.map((showGroup, showIndex) => (
                  <Fragment key={showGroup.clusterId}>
                    <tr>
                      <td
                        colSpan={6}
                        className={`px-0 ${showIndex === 0 ? "pt-0" : "pt-4"}`}
                      >
                        <div
                          className={`border-t border-[var(--color-border)] ${
                            showIndex === 0 ? "pt-0" : "pt-3"
                          }`}
                        >
                          <h2 className="theme-heading text-sm font-semibold sm:text-base">
                            {showGroup.showName}
                          </h2>
                          <p className="theme-copy mt-1 text-xs sm:text-sm">
                            {showGroup.districtRegionName}
                          </p>
                        </div>
                      </td>
                    </tr>
                    {showGroup.breedSections.map((breedSection) => (
                      <Fragment
                        key={`${showGroup.clusterId}-${breedSection.breedCode2}`}
                      >
                        <tr>
                          <td colSpan={6} className="px-0 pt-3">
                            <div className="theme-card mx-1 rounded-xl px-3 py-2">
                              <div className="theme-heading text-sm font-semibold">
                                {breedSection.breedName} ({breedSection.breedCode2})
                              </div>
                              <p className="theme-copy mt-1 text-xs sm:text-sm">
                                {[
                                  `Date ${formatShowDate(
                                    breedSection.scheduledEpoch
                                  )}`,
                                  breedSection.dayIndex != null
                                    ? `Day ${breedSection.dayIndex}`
                                    : null,
                                  "Group Judge:",
                                  null,
                                ]
                                  .filter(Boolean)
                                  .join(" | ")}
                                {" "}
                                {renderJudgeName({
                                  judgeName: breedSection.groupJudgeName,
                                  judgeCode: breedSection.groupJudgeCode,
                                })}
                                {" | "}BIS Judge:{" "}
                                {renderJudgeName({
                                  judgeName: breedSection.bisJudgeName,
                                  judgeCode: breedSection.bisJudgeCode,
                                })}
                              </p>
                            </div>
                          </td>
                        </tr>
                        {breedSection.rows.map((entry) => {
                          const titlePointsAwarded = formatTitlePointsDisplay(
                            getTitlePointsDisplay(entry)
                          );
                          const absenceReasonMessage =
                            getAbsenceReasonMessage(entry);

                          return (
                            <tr key={entry.showEntryId} className="theme-card">
                              <td className="rounded-l-2xl px-3 py-3">
                                <Link
                                  href={`/dogs/${entry.dogId}`}
                                  className="theme-heading font-semibold underline-offset-4 hover:underline"
                                >
                                  {entry.dogDisplayName}
                                </Link>
                                <div className="theme-copy text-xs">
                                  {entry.registrationNumber}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <Link
                                  href={`/shows/${showGroup.clusterId}/results`}
                                  className="theme-heading font-semibold underline-offset-4 hover:underline"
                                >
                                  {showGroup.showName}
                                </Link>
                                <div className="theme-copy text-xs">
                                  {showGroup.districtRegionName}
                                </div>
                              </td>
                              <td className="theme-copy px-3 py-3">
                                {formatShowDate(breedSection.scheduledEpoch)}
                                <div className="theme-copy text-xs">
                                  {breedSection.dayIndex != null
                                    ? `Day ${breedSection.dayIndex}`
                                    : "Day unavailable"}
                                </div>
                              </td>
                              <td className="theme-copy px-3 py-3">
                                {breedSection.breedName} ({breedSection.breedCode2})
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
                                  <span className="theme-copy opacity-50">
                                    &mdash;
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
