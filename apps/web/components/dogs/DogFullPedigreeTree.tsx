import Link from "next/link";

import type { DogProfilePedigreeDogDto } from "@/server/mappers/dog.mapper";

import {
  buildFourGenerationPedigreeSlots,
  type PedigreeSlot,
} from "./pedigreeSlots";
import { PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES } from "./phenotypeHealthPresentation";

type Props = { ancestors: DogProfilePedigreeDogDto[] };

function coiLabel(value: number | null): string {
  return value === null ? "COI: Pending" : `COI: ${value.toFixed(2)}%`;
}

export default function DogFullPedigreeTree({ ancestors }: Props) {
  const slots = buildFourGenerationPedigreeSlots(ancestors);

  return (
    <div className="overflow-x-auto pb-3">
      <div className="min-w-[1180px]">
        <div className="grid grid-cols-4 gap-3 text-xs">
          {["Parents", "Grandparents", "Great-grandparents", "Great-great-grandparents"].map((label) => (
            <div key={label} className="dog-label font-semibold uppercase tracking-[0.14em]">
              {label}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 grid-rows-16 gap-x-3 gap-y-2">
          {slots.map((slot) => (
            <PedigreeSlotCard key={slot.position} slot={slot} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PedigreeSlotCard({ slot }: { slot: PedigreeSlot }) {
  const compact = slot.generation >= 3;
  const className = `relative flex min-h-0 flex-col justify-center rounded-xl border px-3 py-2 text-xs before:absolute before:right-full before:top-1/2 before:hidden before:h-px before:w-3 before:bg-[var(--dog-border)] lg:before:block ${
    slot.ancestor
      ? "dog-card-interactive"
      : "border-dashed border-[var(--dog-border)] bg-[var(--dog-card)]/45 text-[var(--dog-label)]"
  } ${compact ? "py-1.5" : "py-2.5"}`;
  const style = { gridColumn: slot.column, gridRow: `${slot.rowStart} / span ${slot.rowSpan}` };

  const content = slot.ancestor ? (
    <>
      <div className="dog-label text-[0.65rem] font-semibold uppercase tracking-wide">{slot.relationshipLabel}</div>
      <div className={`dog-heading mt-1 font-semibold leading-tight ${compact ? "text-xs" : "text-sm"}`}>{slot.ancestor.displayName}</div>
      {!compact ? <div className="dog-copy mt-1">{slot.ancestor.registrationNumber} · {slot.ancestor.sex === "M" ? "Male" : "Female"}</div> : null}
      <div className="dog-copy mt-1">{slot.ancestor.colorLabel} · {coiLabel(slot.ancestor.storedCoiPercent)}</div>
      <div className="dog-copy mt-1">Progeny: {slot.ancestor.progenyCount.toLocaleString()}</div>
      {compact ? <div className="dog-copy mt-1">{slot.ancestor.healthTestsSummary}</div> : slot.ancestor.detailedHealthResults.map((result) => <div key={result.testCode} className="dog-copy mt-1"><span>{result.displayName}: </span><span className={PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES[result.severityKey]}>{result.resultLabel}</span></div>)}
      {slot.ancestor.healthStatusMarkers.hasFullClearance ? <div className="mt-1 font-semibold text-emerald-700 dark:text-emerald-200">Full health clearance</div> : null}
    </>
  ) : (
    <>
      <div className="dog-label text-[0.65rem] font-semibold uppercase tracking-wide">{slot.relationshipLabel}</div>
      <div className="mt-1 font-semibold">Unknown</div>
      {!compact ? <div className="mt-1">No recorded ancestor</div> : null}
    </>
  );

  return slot.ancestor ? <Link href={slot.ancestor.profileUrl} className={className} style={style}>{content}</Link> : <div className={className} style={style}>{content}</div>;
}
