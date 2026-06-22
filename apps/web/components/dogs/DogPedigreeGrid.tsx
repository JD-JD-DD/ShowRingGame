import Link from "next/link";

import type { DogProfilePedigreeDogDto } from "@/server/mappers/dog.mapper";

type DogPedigreeGridProps = {
  ancestors: DogProfilePedigreeDogDto[];
  compact?: boolean;
};

function healthToneClass(tone: "green" | "yellow" | "red" | null): string {
  switch (tone) {
    case "green":
      return "border-emerald-400/30 bg-emerald-500/10";
    case "yellow":
      return "border-amber-400/30 bg-amber-500/10";
    case "red":
      return "border-red-400/30 bg-red-500/10";
    default:
      return "";
  }
}

function generationFor(relationship: string): number {
  return relationship.split("'s ").length;
}

export default function DogPedigreeGrid({ ancestors, compact = false }: DogPedigreeGridProps) {
  const displayedAncestors = compact ? ancestors.slice(0, 4) : ancestors;

  if (displayedAncestors.length === 0) {
    return <div className="dog-card dog-copy rounded-2xl p-4 text-sm">No recorded ancestors.</div>;
  }

  if (compact) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {displayedAncestors.map((ancestor) => (
          <AncestorCard key={`${ancestor.relationship}-${ancestor.dogId}`} ancestor={ancestor} compact />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((generation) => {
        const generationAncestors = displayedAncestors.filter(
          (ancestor) => generationFor(ancestor.relationship) === generation
        );
        if (generationAncestors.length === 0) return null;

        return (
          <section key={generation}>
            <h2 className="dog-heading text-lg font-semibold">Generation {generation}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {generationAncestors.map((ancestor) => (
                <AncestorCard key={`${ancestor.relationship}-${ancestor.dogId}`} ancestor={ancestor} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AncestorCard({ ancestor, compact = false }: { ancestor: DogProfilePedigreeDogDto; compact?: boolean }) {
  return (
    <Link
      href={ancestor.profileUrl}
      className={`dog-card-interactive rounded-2xl border px-4 py-3 text-sm ${healthToneClass(
        ancestor.healthStatusMarkers.badgeStatus
      )}`}
    >
      <div className="dog-label text-xs uppercase tracking-wide">{ancestor.relationship}</div>
      <div className="dog-heading mt-1 font-semibold">{ancestor.displayName}</div>
      <div className="dog-copy mt-2 text-xs">{ancestor.colorLabel}</div>
      {!compact
        ? ancestor.detailedHealthResults.map((result) => (
            <div key={result.testCode} className="dog-copy mt-1 text-xs">
              {result.displayName}: {result.resultLabel}
            </div>
          ))
        : null}
      {!compact && ancestor.healthSeverityCounts ? (
        <div className="dog-copy mt-2 text-xs">
          Health: {ancestor.healthSeverityCounts.green} green · {ancestor.healthSeverityCounts.yellow} yellow ·{" "}
          {ancestor.healthSeverityCounts.red} red
        </div>
      ) : null}
      {ancestor.healthStatusMarkers.hasFullClearance ? (
        <div className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-200">Full health clearance</div>
      ) : null}
    </Link>
  );
}
