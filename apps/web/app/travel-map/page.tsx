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
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">
              Show Districts
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              Travel Map
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
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
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
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
