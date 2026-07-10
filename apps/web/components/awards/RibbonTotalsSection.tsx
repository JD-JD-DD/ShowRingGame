"use client";

import { useEffect, useId, useRef, useState } from "react";

import { RibbonTotalTile } from "@/components/awards/RibbonTotalTile";
import type {
  RibbonRoomAwardCode,
  RibbonRoomRibbonTotalDto,
} from "@/server/services/ribbonRoom.service";

import {
  getRegularRibbonAssetPath,
  getRibbonOccurrenceLabel,
  RIBBON_LABELS,
  RIBBON_TOTAL_ORDER,
} from "@/lib/awards/ribbonRoomUi";

type RibbonTotalsSectionProps = {
  ribbons: RibbonRoomRibbonTotalDto[];
  initialSelectedAward?: RibbonRoomAwardCode | null;
};

type SelectedRibbon = RibbonRoomRibbonTotalDto | null;

function detailRow(label: string, value: string | number | null) {
  if (value === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-[var(--dog-copy)]">
      <span className="font-semibold text-white">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function RibbonTotalsSection({
  ribbons,
  initialSelectedAward = null,
}: RibbonTotalsSectionProps) {
  const ribbonByAward = new Map(ribbons.map((ribbon) => [ribbon.award, ribbon]));
  const [selectedRibbon, setSelectedRibbon] = useState<SelectedRibbon>(
    initialSelectedAward ? ribbonByAward.get(initialSelectedAward) ?? null : null
  );
  const triggerRefs = useRef<
    Partial<Record<RibbonRoomAwardCode, HTMLButtonElement | null>>
  >({});
  const headingId = useId();
  const descriptionId = useId();
  const detailHeadingId = useId();
  const detailDescriptionId = useId();

  useEffect(() => {
    if (!selectedRibbon) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedRibbon(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedRibbon]);

  function openDetails(award: RibbonRoomAwardCode) {
    const ribbon = ribbonByAward.get(award);

    if (!ribbon || ribbon.count <= 0) {
      return;
    }

    setSelectedRibbon(ribbon);
  }

  function closeDetails() {
    const award = selectedRibbon?.award;
    setSelectedRibbon(null);

    if (award) {
      requestAnimationFrame(() => {
        triggerRefs.current[award]?.focus();
      });
    }
  }

  return (
    <>
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <span id={headingId} className="sr-only">
          Ribbon Totals
        </span>
        <span id={descriptionId} className="sr-only">
          Select a ribbon total with recorded wins to view the full award history.
        </span>
        {RIBBON_TOTAL_ORDER.map((award) => {
          const count = ribbonByAward.get(award)?.count ?? 0;
          const tile = (
            <RibbonTotalTile
              label={award}
              count={count}
              assetPath={getRegularRibbonAssetPath(award)}
              alt={RIBBON_LABELS[award]}
            />
          );

          if (count <= 0) {
            return (
              <div key={award} aria-disabled="true">
                {tile}
              </div>
            );
          }

          return (
            <button
              key={award}
              ref={(element) => {
                triggerRefs.current[award] = element;
              }}
              type="button"
              onClick={() => openDetails(award)}
              className="rounded-[22px] text-left outline-none transition duration-150 hover:-translate-y-0.5 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-purple-300/70"
              aria-haspopup="dialog"
              aria-label={`Open ${RIBBON_LABELS[award]} ribbon details`}
            >
              {tile}
            </button>
          );
        })}
      </div>

      {selectedRibbon ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,6,18,0.82)] px-3 py-4 sm:px-4 sm:py-6"
          onClick={closeDetails}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailHeadingId}
            aria-describedby={detailDescriptionId}
            className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[30px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(8,12,28,0.96))] shadow-[0_32px_90px_rgba(0,0,0,0.48)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--dog-border)] px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <div
                  id={detailDescriptionId}
                  className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]"
                >
                  Ribbon Detail
                </div>
                <h3
                  id={detailHeadingId}
                  className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]"
                >
                  {RIBBON_LABELS[selectedRibbon.award]}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--dog-copy)]">
                  {selectedRibbon.count} recorded occurrence
                  {selectedRibbon.count === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl border border-[var(--dog-border)] bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div className="mb-5 flex items-center gap-4 rounded-[24px] border border-[var(--dog-border)] bg-black/20 p-4">
                <img
                  src={getRegularRibbonAssetPath(selectedRibbon.award)}
                  alt={RIBBON_LABELS[selectedRibbon.award]}
                  className="h-28 w-28 shrink-0 object-contain"
                />
                <div>
                  <div className="text-lg font-semibold tracking-tight text-white">
                    {RIBBON_LABELS[selectedRibbon.award]}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[var(--dog-copy)]">
                    Full recorded history, newest first.
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {[...selectedRibbon.history]
                  .sort((a, b) => b.year - a.year || b.week - a.week)
                  .map((occurrence, index) => (
                    <article
                      key={`${occurrence.originalAwardCode}-${occurrence.show.name}-${occurrence.year}-${occurrence.week}-${index}`}
                      className="rounded-[22px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(4,9,20,0.34))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-lg font-semibold tracking-tight text-white">
                            {occurrence.show.name}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-[var(--dog-copy)]">
                            Year {occurrence.year}, Week {occurrence.week}
                          </div>
                        </div>
                        <div className="rounded-full border border-[var(--dog-border)] bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dog-label)]">
                          {getRibbonOccurrenceLabel(occurrence)}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2.5">
                        {detailRow(
                          "Judge",
                          occurrence.judge.name || "Judge not recorded"
                        )}
                        {occurrence.dogsDefeated > 0
                          ? detailRow("Dogs defeated", occurrence.dogsDefeated)
                          : null}
                        {detailRow("Points earned", `${occurrence.pointsEarned} points`)}
                        {detailRow(
                          "Award",
                          getRibbonOccurrenceLabel(occurrence)
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
