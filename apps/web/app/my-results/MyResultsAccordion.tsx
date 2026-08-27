"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { epochToDate } from "@/lib/gameClock";
import { formatShowAwardLabels } from "@/lib/showAwards";
import { formatShowEntryAbsenceReason } from "@/lib/showEntryAbsence";
import { buildTitlePointsDisplay, formatTitlePointsDisplay } from "@/lib/titlePoints";

import type { MyResultsBreed, MyResultsDogResult, MyResultsGroup, MyResultsHierarchy, MyResultsJudge } from "./myResults.contract";

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatJudgeName(judge: MyResultsJudge | null): string {
  return judge?.name ?? "Judge unavailable";
}

type JudgeSummary =
  | { kind: "UNIFORM"; judge: MyResultsJudge | null }
  | { kind: "MULTIPLE" };

function summarizeJudges(entries: Iterable<MyResultsDogResult>): JudgeSummary {
  let resolvedJudge: MyResultsJudge | null | undefined;

  for (const entry of entries) {
    const judge = entry.breedJudge?.judge ?? null;
    if (resolvedJudge === undefined) {
      resolvedJudge = judge;
      continue;
    }
    if (resolvedJudge?.judgeCode !== judge?.judgeCode) {
      return { kind: "MULTIPLE" };
    }
  }

  return { kind: "UNIFORM", judge: resolvedJudge ?? null };
}

function summarizeBreedJudge(breed: MyResultsBreed): JudgeSummary {
  return summarizeJudges(breed.dogResults);
}

function summarizeGroupJudge(group: MyResultsGroup): JudgeSummary {
  function* dogResults(): Generator<MyResultsDogResult> {
    for (const breed of group.breeds) {
      yield* breed.dogResults;
    }
  }

  return summarizeJudges(dogResults());
}

function getAbsenceReasonMessage(entry: MyResultsDogResult): string | null {
  return entry.entryStatus === "ABSENT"
    ? formatShowEntryAbsenceReason(entry.absenceReason)
    : null;
}

function formatResult(entry: MyResultsDogResult): string {
  if (!entry.result) {
    if (entry.entryStatus === "ABSENT") return "Absent";
    if (entry.entryStatus === "INELIGIBLE") return "Ineligible";
    if (entry.entryStatus === "JUDGED") return "DNP";
    return "Pending";
  }

  return entry.result.awardCodes.length > 0
    ? formatShowAwardLabels([...entry.result.awardCodes])
    : "DNP";
}

function formatTitlePoints(entry: MyResultsDogResult): string | null {
  const result = entry.result;
  return formatTitlePointsDisplay(buildTitlePointsDisplay({
    championshipPointsAwarded: result?.championshipPointsAwarded ?? 0,
    isChampionshipMajor: result?.isChampionshipMajor ?? false,
    grandChampionCredits: result ? [...result.grandChampionCredits] : [],
  }));
}

function ExpandButton(props: {
  expanded: boolean;
  panelId: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={props.expanded}
      aria-controls={props.panelId}
      aria-label={`${props.expanded ? "Collapse" : "Expand"} ${props.label}`}
      onClick={props.onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span aria-hidden="true" className="w-4 shrink-0 text-center text-base">
        {props.expanded ? "⌄" : "›"}
      </span>
      {props.children}
    </button>
  );
}

export default function MyResultsAccordion({ hierarchy }: { hierarchy: MyResultsHierarchy }) {
  const [expandedBranches, setExpandedBranches] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(branchId: string) {
    setExpandedBranches((current) => {
      const next = new Set(current);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {hierarchy.map((cluster) => {
        const clusterBranchId = `cluster:${cluster.id}`;
        const clusterPanelId = `my-results-${clusterBranchId}`;
        const clusterExpanded = expandedBranches.has(clusterBranchId);

        return (
          <section key={cluster.id} className="theme-card rounded-2xl">
            <ExpandButton
              expanded={clusterExpanded}
              panelId={clusterPanelId}
              label={`show cluster ${cluster.name}`}
              onClick={() => toggle(clusterBranchId)}
            >
              <span>
                <span role="heading" aria-level={2} className="theme-heading block font-semibold">{cluster.name}</span>
                <span className="theme-copy block text-xs">{cluster.districtRegionName}</span>
              </span>
            </ExpandButton>

            {clusterExpanded ? (
              <div id={clusterPanelId} className="space-y-2 border-t border-[var(--color-border)] px-2 py-2 sm:ml-5">
                {cluster.showDays.map((showDay) => {
                  const dayBranchId = `${clusterBranchId}:day:${showDay.id}`;
                  const dayPanelId = `my-results-${dayBranchId}`;
                  const dayExpanded = expandedBranches.has(dayBranchId);
                  const dayLabel = showDay.dayIndex != null ? `Day ${showDay.dayIndex}` : "Show day";

                  return (
                    <div key={showDay.id} className="rounded-xl border border-[var(--color-border)]">
                      <ExpandButton
                        expanded={dayExpanded}
                        panelId={dayPanelId}
                        label={`${dayLabel} for ${cluster.name}`}
                        onClick={() => toggle(dayBranchId)}
                      >
                        <span>
                          <span role="heading" aria-level={3} className="theme-heading block font-semibold">{dayLabel}</span>
                          <span className="theme-copy block text-xs">{formatShowDate(showDay.scheduledEpoch)} · BIS Judge: {formatJudgeName(showDay.bisJudge)}</span>
                        </span>
                      </ExpandButton>

                      {dayExpanded ? (
                        <div id={dayPanelId} className="space-y-2 border-t border-[var(--color-border)] px-2 py-2 sm:ml-5">
                          {showDay.groups.map((group) => {
                            const groupBranchId = `${dayBranchId}:group:${group.code}`;
                            const groupPanelId = `my-results-${groupBranchId}`;
                            const groupExpanded = expandedBranches.has(groupBranchId);
                            const groupJudgeSummary = summarizeGroupJudge(group);

                            return (
                              <div key={group.code} className="rounded-xl border border-[var(--color-border)]">
                                <ExpandButton
                                  expanded={groupExpanded}
                                  panelId={groupPanelId}
                                  label={`${group.name} group`}
                                  onClick={() => toggle(groupBranchId)}
                                >
                                  <span>
                                    <span role="heading" aria-level={4} className="theme-heading block font-semibold">{group.name}</span>
                                    <span className="theme-copy block text-xs">
                                      {groupJudgeSummary.kind === "UNIFORM"
                                        ? `Judge: ${formatJudgeName(groupJudgeSummary.judge)}`
                                        : "Multiple judges"}
                                    </span>
                                  </span>
                                </ExpandButton>

                                {groupExpanded ? (
                                  <div id={groupPanelId} className="space-y-2 border-t border-[var(--color-border)] px-2 py-2 sm:ml-5">
                                    {group.breeds.map((breed) => {
                                      const breedBranchId = `${groupBranchId}:breed:${breed.code2}`;
                                      const breedPanelId = `my-results-${breedBranchId}`;
                                      const breedExpanded = expandedBranches.has(breedBranchId);
                                      const breedJudgeSummary = summarizeBreedJudge(breed);
                                      const showBreedJudge = groupJudgeSummary.kind === "MULTIPLE";
                                      const showDogJudge = showBreedJudge && breedJudgeSummary.kind === "MULTIPLE";

                                      return (
                                        <div key={breed.code2} className="rounded-xl border border-[var(--color-border)]">
                                          <ExpandButton
                                            expanded={breedExpanded}
                                            panelId={breedPanelId}
                                            label={`${breed.name} breed`}
                                            onClick={() => toggle(breedBranchId)}
                                          >
                                            <span>
                                              <span role="heading" aria-level={5} className="theme-heading block font-semibold">{breed.name}</span>
                                              {showBreedJudge ? (
                                                <span className="theme-copy block text-xs">
                                                  {breedJudgeSummary.kind === "UNIFORM"
                                                    ? `Judge: ${formatJudgeName(breedJudgeSummary.judge)}`
                                                    : "Multiple judges"}
                                                </span>
                                              ) : null}
                                            </span>
                                          </ExpandButton>

                                          {breedExpanded ? (
                                            <div id={breedPanelId} className="space-y-2 border-t border-[var(--color-border)] px-3 py-3 sm:ml-5">
                                              {breed.dogResults.map((entry) => {
                                                const absenceReasonMessage = getAbsenceReasonMessage(entry);
                                                const titlePoints = formatTitlePoints(entry);

                                                return (
                                                  <article key={entry.showEntryId} className="theme-panel rounded-xl p-3">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                      <div>
                                                        <Link href={`/dogs/${entry.dogId}`} className="theme-heading font-semibold underline-offset-4 hover:underline">
                                                          {entry.dogDisplayName}
                                                        </Link>
                                                        <p className="theme-copy text-xs">{entry.registrationNumber}</p>
                                                      </div>
                                                      <div className="text-right">
                                                        <p className="theme-heading font-semibold">{formatResult(entry)}</p>
                                                        <p className="theme-copy text-xs">{titlePoints ?? "No title points"}</p>
                                                        {showDogJudge ? <p className="theme-copy text-xs">Judge: {formatJudgeName(entry.breedJudge?.judge ?? null)}</p> : null}
                                                      </div>
                                                    </div>
                                                    {absenceReasonMessage ? <p className="theme-copy mt-2 text-xs">{absenceReasonMessage}</p> : null}
                                                  </article>
                                                );
                                              })}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
