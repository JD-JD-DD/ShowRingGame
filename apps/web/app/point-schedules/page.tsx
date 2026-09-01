import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  getPublishedAnnualChampionshipPointScheduleTable,
  listPublishedAnnualChampionshipPointScheduleYears,
} from "@/server/services/annualChampionshipPointSchedule.service";
import PointScheduleTableClient from "./PointScheduleTableClient";
import { getShowDistrictPresentationLabel, SHOW_DISTRICT_REGIONS, SHOW_YEAR_HOURS } from "@showring/rules";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ year?: string | string[]; district?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

export default async function PointSchedulesPage({ searchParams }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const kennel = await db.kennel.findUnique({ where: { userId }, select: { id: true } });
  if (!kennel) redirect("/onboarding");

  const params = searchParams ? await searchParams : {};
  const years = await listPublishedAnnualChampionshipPointScheduleYears({ client: db as never });
  const currentYear = Math.floor(getCurrentEpoch() / SHOW_YEAR_HOURS) + 1;
  const requestedYear = parsePositiveInteger(first(params.year));
  const selectedYear = years.some((year) => year.effectiveYear === requestedYear)
    ? requestedYear!
    : years.find((year) => year.effectiveYear === currentYear)?.effectiveYear ?? years[0]?.effectiveYear ?? null;
  const requestedDistrict = parsePositiveInteger(first(params.district));
  const selectedDistrict = requestedDistrict && requestedDistrict >= 1 && requestedDistrict <= 15
    ? requestedDistrict
    : null;
  const table = selectedYear === null
    ? null
    : await getPublishedAnnualChampionshipPointScheduleTable({
        client: db as never,
        effectiveYear: selectedYear,
        ...(selectedDistrict === null ? {} : { district: selectedDistrict }),
      });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="theme-panel mb-6 rounded-[28px] px-6 py-6">
        <p className="theme-label text-sm uppercase tracking-[0.25em]">Championship Reference</p>
        <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">Point Schedules</h1>
        <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">Point schedules show the minimum number of Dogs or Bitches required for a 1–5 point Championship win in each breed and District.</p>
      </header>

      {selectedYear === null || !table ? (
        <section className="theme-panel theme-copy rounded-[28px] p-6 text-sm">No published Point Schedule is available yet.</section>
      ) : (
        <>
          <section className="theme-card mb-6 rounded-[24px] p-4">
            <form className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <div>
                <label htmlFor="year" className="theme-copy mb-1 block text-xs font-semibold uppercase tracking-wide">Point Schedule Year</label>
                <select id="year" name="year" defaultValue={selectedYear} className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  {years.map((year) => <option key={year.effectiveYear} value={year.effectiveYear}>Year {year.effectiveYear}{year.effectiveYear === currentYear ? " (Current)" : year.effectiveYear > currentYear ? " (Upcoming)" : ""}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="district" className="theme-copy mb-1 block text-xs font-semibold uppercase tracking-wide">District</label>
                <select id="district" name="district" defaultValue={selectedDistrict ?? ""} className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  <option value="">All Districts</option>
                  {SHOW_DISTRICT_REGIONS.map((region) => <option key={region.district} value={region.district}>{getShowDistrictPresentationLabel(region.district)}</option>)}
                </select>
              </div>
              <button type="submit" className="theme-primary-button rounded-xl px-5 py-2.5 text-sm font-semibold sm:col-span-2">View Point Schedule</button>
            </form>
          </section>

          <section className="theme-panel rounded-[28px] p-5">
            <h2 className="theme-heading text-2xl font-semibold">Year {table.effectiveYear} Point Schedule{selectedDistrict ? ` — ${getShowDistrictPresentationLabel(selectedDistrict)}` : ""}</h2>
            <p className="theme-copy mt-2 text-sm">Published schedules remain available for reference by game year.</p>
            {table.incompleteBreedKeys.length > 0 ? <p className="mt-4 text-sm text-[var(--color-danger-text)]">Some published schedule rows are incomplete and cannot be displayed.</p> : null}
            {!selectedDistrict && table.divisions.length > 1 ? <nav aria-label="District sections" className="mt-5 flex flex-wrap gap-2">{table.divisions.map((division) => <a key={division.district} href={`#district-${division.district}`} className="theme-secondary-button rounded-full px-3 py-1.5 text-xs font-semibold">{getShowDistrictPresentationLabel(division.district)}</a>)}</nav> : null}
            {table.divisions.length === 0 ? <p className="theme-copy mt-6 text-sm">No published schedule rows are available for this District.</p> : <PointScheduleTableClient divisions={table.divisions} showDistrictHeadings={!selectedDistrict} />}
          </section>
        </>
      )}
    </main>
  );
}
