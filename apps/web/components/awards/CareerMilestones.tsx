import type { RibbonRoomMilestoneDto } from "@/server/services/ribbonRoom.service";

import { MILESTONE_LABELS, milestoneTone } from "@/lib/awards/ribbonRoomUi";

type CareerMilestonesProps = {
  milestones: RibbonRoomMilestoneDto[];
};

function toneClass(type: RibbonRoomMilestoneDto["type"]): string {
  const tone = milestoneTone(type);

  if (tone === "premium") {
    return "border-amber-300/25 bg-amber-500/10";
  }

  if (tone === "featured") {
    return "border-fuchsia-300/25 bg-fuchsia-500/10";
  }

  return "border-[var(--dog-border)] bg-black/20";
}

export function CareerMilestones({ milestones }: CareerMilestonesProps) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--dog-border)] bg-black/20 px-4 py-5 text-sm text-[var(--dog-copy)]">
        Career milestones will appear as this dog builds a show record.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {milestones.map((milestone) => (
        <article
          key={`${milestone.type}-${milestone.year}-${milestone.week}`}
          className={`rounded-2xl border px-4 py-4 ${toneClass(milestone.type)}`}
        >
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--dog-label)]">
            Year {milestone.year}, Week {milestone.week}
          </div>
          <div className="mt-3 text-lg font-semibold text-white">
            {MILESTONE_LABELS[milestone.type]}
          </div>
        </article>
      ))}
    </div>
  );
}
