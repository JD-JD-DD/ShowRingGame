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
        className="mb-8 rounded-[28px] border px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-purple-100/75">
              District {region.district}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              {region.shortName}
            </h1>
            <p className="mt-3 text-sm text-purple-100/80">{region.name}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/travel-map"
              className="rounded-2xl border border-white/20 bg-black/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              District Map
            </Link>
            <Link
              href="/shows"
              className="rounded-2xl border border-white/20 bg-black/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              All Shows
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <h2 className="text-2xl font-semibold text-white">Annual Shows</h2>
          <p className="mt-2 text-sm leading-6 text-purple-100/70">
            The regular show calendar returns to this district during these
            weeks each year.
          </p>

          <div className="mt-5 grid gap-3">
            {showSchedule.map((show) => (
              <div
                key={`${show.weekInYear}:${show.name}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <span className="text-sm font-semibold text-white">
                  {show.name}
                </span>
                <span className="shrink-0 rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-100">
                  Week {show.weekInYear}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <h2 className="text-2xl font-semibold text-white">
            Player Kennels
          </h2>
          <p className="mt-2 text-sm leading-6 text-purple-100/70">
            Registered kennels currently assigned to {region.shortName}.
          </p>

          {kennels.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-purple-100/65">
              No player kennels are assigned to this district yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {kennels.map((kennel) => (
                <Link
                  key={kennel.id}
                  href={`/kennels/${kennel.slug}`}
                  style={getDistrictPanelStyle(region)}
                  className="rounded-2xl border px-4 py-3 transition hover:bg-white/10"
                >
                  <div className="text-sm font-semibold text-white">
                    {kennel.name}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-purple-100/65">
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
