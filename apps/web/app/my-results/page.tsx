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
import type { MyResultsDogResult } from "./myResults.contract";
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
        {hierarchy.length === 0 ? (
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
                {hierarchy.map((cluster, clusterIndex) => (
                  <Fragment key={cluster.id}>
                    <tr>
                      <td
                        colSpan={6}
                        className={`px-0 ${clusterIndex === 0 ? "pt-0" : "pt-4"}`}
                      >
                        <div
                          className={`border-t border-[var(--color-border)] ${
                            clusterIndex === 0 ? "pt-0" : "pt-3"
                          }`}
                        >
                          <h2 className="theme-heading text-sm font-semibold sm:text-base">
                            {cluster.name}
                          </h2>
                          <p className="theme-copy mt-1 text-xs sm:text-sm">
                            {cluster.districtRegionName}
                          </p>
                        </div>
                      </td>
                    </tr>
                    {cluster.showDays.map((showDay) => (
                      <Fragment key={showDay.id}>
                        <tr>
                          <td colSpan={6} className="px-0 pt-3">
                            <div className="theme-card mx-1 rounded-xl px-3 py-2">
                              <div className="theme-heading text-sm font-semibold">
                                {`Date ${formatShowDate(showDay.scheduledEpoch)}`}
                                {showDay.dayIndex != null
                                  ? ` | Day ${showDay.dayIndex}`
                                  : " | Day unavailable"}
                              </div>
                              <p className="theme-copy mt-1 text-xs sm:text-sm">
                                BIS Judge:{" "}
                                {renderJudgeName({
                                  judgeName: showDay.bisJudge?.name ?? null,
                                  judgeCode: showDay.bisJudge?.judgeCode ?? null,
                                })}
                              </p>
                            </div>
                          </td>
                        </tr>
                        {showDay.groups.map((group) => (
                          <Fragment key={group.code}>
                            <tr>
                              <td colSpan={6} className="px-3 pt-3">
                                <div className="theme-copy text-xs sm:text-sm">
                                  {group.name} | Group Judge:{" "}
                                  {renderJudgeName({
                                    judgeName: group.judge?.judge.name ?? null,
                                    judgeCode: group.judge?.judge.judgeCode ?? null,
                                  })}
                                </div>
                              </td>
                            </tr>
                            {group.breeds.map((breed) => (
                              <Fragment key={breed.code2}>
                                <tr>
                                  <td colSpan={6} className="px-3 pt-2">
                                    <div className="theme-heading text-sm font-semibold">
                                      {breed.name} ({breed.code2})
                                    </div>
                                  </td>
                                </tr>
                                {breed.dogResults.map((entry) => {
                                  const titlePointsAwarded = formatTitlePointsDisplay(
                                    getTitlePointsDisplay(entry)
                                  );
                                  const absenceReasonMessage = getAbsenceReasonMessage(entry);

                                  return (
                                    <tr key={entry.showEntryId} className="theme-card">
                                      <td className="rounded-l-2xl px-3 py-3">
                                        <Link href={`/dogs/${entry.dogId}`} className="theme-heading font-semibold underline-offset-4 hover:underline">
                                          {entry.dogDisplayName}
                                        </Link>
                                        <div className="theme-copy text-xs">{entry.registrationNumber}</div>
                                      </td>
                                      <td className="px-3 py-3">
                                        <Link href={`/shows/${cluster.id}/results`} className="theme-heading font-semibold underline-offset-4 hover:underline">
                                          {cluster.name}
                                        </Link>
                                        <div className="theme-copy text-xs">{cluster.districtRegionName}</div>
                                      </td>
                                      <td className="theme-copy px-3 py-3">
                                        {formatShowDate(showDay.scheduledEpoch)}
                                        <div className="theme-copy text-xs">{showDay.dayIndex != null ? `Day ${showDay.dayIndex}` : "Day unavailable"}</div>
                                      </td>
                                      <td className="theme-copy px-3 py-3">{breed.name} ({breed.code2})</td>
                                      <td className="theme-heading px-3 py-3 font-semibold">
                                        {formatResult(entry)}
                                        {absenceReasonMessage ? <div className="theme-copy mt-1 text-xs font-normal">{absenceReasonMessage}</div> : null}
                                      </td>
                                      <td className="theme-heading rounded-r-2xl px-3 py-3 font-semibold">
                                        {titlePointsAwarded ?? <span className="theme-copy opacity-50">&mdash;</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            ))}
                          </Fragment>
                        ))}
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
