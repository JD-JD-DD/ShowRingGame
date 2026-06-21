import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import DistrictTravelMap from "./DistrictTravelMap";

export default async function TravelMapPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { homeDistrict: true }
  });

  if (!kennel) redirect("/onboarding");

  const kennelCountRows = await db.kennel.groupBy({
    by: ["homeDistrict"],
    where: {
      isNpc: false,
      homeDistrict: { not: null }
    },
    _count: { homeDistrict: true }
  });
  const kennelCounts = Object.fromEntries(
    kennelCountRows.flatMap((row) =>
      row.homeDistrict === null
        ? []
        : [[row.homeDistrict, row._count.homeDistrict]]
    )
  );

  return (
    <main className="travel-page mx-auto max-w-7xl px-6 py-8">
      <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.25em]">
              Show Districts
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
              Travel Map
            </h1>
            <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
              Follow the show circuit from Cascadia to Florida Coast. Each
              district keeps its own color so your kennel region remains easy
              to recognize throughout the game.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              All Shows
            </Link>
            <Link
              href="/districts/kennels"
              className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            >
              All Kennels
            </Link>
            <Link
              href="/kennel"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              My Kennel
            </Link>
          </div>
        </div>
      </header>

      <DistrictTravelMap
        homeDistrict={kennel.homeDistrict ?? 1}
        kennelCounts={kennelCounts}
      />
    </main>
  );
}
