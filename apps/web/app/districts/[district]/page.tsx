import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getDistrictPanelStyle } from "@/lib/districtStyles";
import { getSessionUserId } from "@/lib/session";
import {
  generateAnnualShowClusterTemplates,
  getShowDistrictRegion
} from "@showring/rules";

export default async function DistrictPage({
  params
}: {
  params: Promise<{ district: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const district = Number((await params).district);
  if (!Number.isInteger(district)) notFound();

  let region;
  try {
    region = getShowDistrictRegion(district);
  } catch {
    notFound();
  }

  const [showSchedule, kennels] = await Promise.all([
    Promise.resolve(
      generateAnnualShowClusterTemplates()
        .filter((template) => template.district === district)
        .map((template) => ({
          name: template.name,
          weekInYear: template.weekInYear
        }))
    ),
    db.kennel.findMany({
      where: {
        homeDistrict: district,
        isNpc: false
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        publicSlogan: true
      }
    })
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-white">
      <header
        style={getDistrictPanelStyle(region)}
        className="mb-8 rounded-[28px] border px-6 py-6 shadow-[var(--dog-shadow)]"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--dog-copy)]">
              District {region.district}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              {region.shortName}
            </h1>
            <p className="mt-3 text-sm text-[var(--dog-copy)]">{region.name}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/travel-map"
              className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--dog-card)]"
            >
              District Map
            </Link>
            <Link
              href="/shows"
              className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--dog-card)]"
            >
              All Shows
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-6 shadow-[var(--dog-shadow)]">
          <h2 className="text-2xl font-semibold text-white">Annual Shows</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--dog-copy)]">
            The regular show calendar returns to this district during these
            weeks each year.
          </p>

          <div className="mt-5 grid gap-3">
            {showSchedule.map((show) => (
              <div
                key={`${show.weekInYear}:${show.name}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3"
              >
                <span className="text-sm font-semibold text-white">
                  {show.name}
                </span>
                <span className="shrink-0 rounded-full border border-[var(--dog-border)] bg-purple-500/10 px-3 py-1 text-xs font-semibold text-[var(--dog-heading)]">
                  Week {show.weekInYear}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-6 shadow-[var(--dog-shadow)]">
          <h2 className="text-2xl font-semibold text-white">
            Player Kennels
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--dog-copy)]">
            Registered kennels currently assigned to {region.shortName}.
          </p>

          {kennels.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3 text-sm text-[var(--dog-copy)]">
              No player kennels are assigned to this district yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {kennels.map((kennel) => (
                <Link
                  key={kennel.id}
                  href={`/kennels/${kennel.slug}`}
                  style={getDistrictPanelStyle(region)}
                  className="rounded-2xl border px-4 py-3 transition hover:bg-[var(--dog-card)]"
                >
                  <div className="text-sm font-semibold text-white">
                    {kennel.name}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--dog-copy)]">
                    {kennel.publicSlogan?.trim() || "View this kennel's dogs."}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
