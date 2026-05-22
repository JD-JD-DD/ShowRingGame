import Link from "next/link";

import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { generateAnnualShowClusterTemplates } from "@showring/rules";

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusTone(status: string): string {
  switch (status) {
    case "COMPLETE":
    case "RESULTS_PUBLISHED":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "OPEN":
    case "ENTRY_OPEN":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "CLOSED":
    case "ENTRY_LOCKED":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "CANCELLED":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    default:
      return "border-purple-300/20 bg-white/5 text-purple-100";
  }
}

function getGeneratedTemplateId(clusterId: string): string | null {
  const match = clusterId.match(/^generated-year-\d+-(week-\d+-slot-\d+)$/);

  return match?.[1] ?? null;
}

function formatShowDayNames(dayNames: string[]): string {
  const displayOrder = ["Friday", "Saturday", "Sunday", "Monday"];

  return [...dayNames]
    .sort((a, b) => displayOrder.indexOf(a) - displayOrder.indexOf(b))
    .join(", ");
}

export default async function ShowArchivePage() {
  const templates = generateAnnualShowClusterTemplates();
  const clusters = await db.showCluster.findMany({
    orderBy: [{ year: "desc" }, { startEpoch: "desc" }],
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          _count: { select: { showResults: true } },
        },
      },
    },
  });
  const clustersByTemplate = new Map<string, typeof clusters>();

  for (const cluster of clusters) {
    const templateId = getGeneratedTemplateId(cluster.id);

    if (!templateId) {
      continue;
    }

    const templateClusters = clustersByTemplate.get(templateId) ?? [];
    templateClusters.push(cluster);
    clustersByTemplate.set(templateId, templateClusters);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
              Results Archive
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              Annual Show Calendar
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Browse the permanent cluster titles. Each cluster gathers every
              game year that has been generated, entered, judged, or published.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Upcoming Shows
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
        <div className="grid gap-3">
          {templates.map((template) => {
            const templateId = `week-${template.weekInYear}-slot-${template.slotIndex + 1}`;
            const templateClusters = clustersByTemplate.get(templateId) ?? [];

            return (
              <div
                key={templateId}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-purple-200/70">
                      Week {template.weekInYear} · Slot {template.slotIndex + 1}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {template.name}
                    </h2>
                    <div className="mt-2 text-sm text-purple-100/65">
                      {formatShowDayNames(template.showDayNames)} · District{" "}
                      {template.district}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap justify-start gap-2 lg:justify-end">
                    {templateClusters.length === 0 ? (
                      <span className="rounded-full border border-purple-300/20 bg-black/20 px-3 py-1 text-xs text-purple-100/60">
                        No generated years yet
                      </span>
                    ) : (
                      templateClusters.map((cluster) => {
                        const resultCount = cluster.showDays.reduce(
                          (total, day) => total + day._count.showResults,
                          0
                        );

                        return (
                          <Link
                            key={cluster.id}
                            href={`/shows/${cluster.id}/results`}
                            className="rounded-xl border border-purple-300/25 bg-black/20 px-3 py-2 text-sm text-purple-100 transition hover:border-sky-300/40 hover:bg-sky-500/10"
                          >
                            <span className="font-semibold text-white">
                              Year {cluster.year}
                            </span>
                            <span className="ml-2 text-purple-100/60">
                              {formatShowDate(cluster.startEpoch)}
                            </span>
                            <span
                              className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(cluster.status)}`}
                            >
                              {cluster.status}
                            </span>
                            {resultCount > 0 ? (
                              <span className="ml-2 text-sky-100">
                                {resultCount} result
                                {resultCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
