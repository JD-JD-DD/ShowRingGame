import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getDistrictPanelStyle } from "@/lib/districtStyles";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getAnnualShowCalendarTemplatesForYear } from "@/server/services/annualShowSchedule.service";
import {
  SHOW_YEAR_HOURS,
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
  const currentEpoch = getCurrentEpoch();
  const currentYear = Math.floor(currentEpoch / SHOW_YEAR_HOURS) + 1;

  let region;
  try {
    region = getShowDistrictRegion(district);
  } catch {
    notFound();
  }

  const [showSchedule, kennels] = await Promise.all([
    Promise.resolve(
      getAnnualShowCalendarTemplatesForYear(currentYear)
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
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header
        style={getDistrictPanelStyle(region)}
        className="mb-8 rounded-[28px] border px-6 py-6 shadow-[var(--dog-shadow)]"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-label text-sm font-semibold uppercase tracking-[0.25em]">
              District {region.district}
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
              {region.shortName}
            </h1>
            <p className="theme-copy mt-3 text-sm">{region.name}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/travel-map"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              District Map
            </Link>
            <Link
              href="/shows"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              All Shows
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="theme-panel rounded-[28px] p-6">
          <h2 className="theme-heading text-2xl font-semibold">Annual Shows</h2>
          <p className="theme-copy mt-2 text-sm leading-6">
            The regular show calendar returns to this district during these
            weeks each year.
          </p>

          <div className="mt-5 grid gap-3">
            {showSchedule.map((show) => (
              <div
                key={`${show.weekInYear}:${show.name}`}
                className="theme-card flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
              >
                <span className="theme-heading text-sm font-semibold">
                  {show.name}
                </span>
                <span className="theme-neutral-badge shrink-0 rounded-full px-3 py-1 text-xs font-semibold">
                  Week {show.weekInYear}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="theme-panel rounded-[28px] p-6">
          <h2 className="theme-heading text-2xl font-semibold">
            Player Kennels
          </h2>
          <p className="theme-copy mt-2 text-sm leading-6">
            Registered kennels currently assigned to {region.shortName}.
          </p>

          {kennels.length === 0 ? (
            <p className="theme-card theme-copy mt-5 rounded-2xl px-4 py-3 text-sm">
              No player kennels are assigned to this district yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {kennels.map((kennel) => (
                <Link
                  key={kennel.id}
                  href={`/kennels/${kennel.slug}`}
                  style={getDistrictPanelStyle(region)}
                  className="rounded-2xl border px-4 py-3 transition"
                >
                  <div className="theme-heading text-sm font-semibold">
                    {kennel.name}
                  </div>
                  <div className="theme-copy mt-1 text-xs leading-5">
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
