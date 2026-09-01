"use client";

import { useMemo, useState } from "react";

import {
  compareBreedGroupNames,
  normalizeBreedGroupName,
} from "@/components/breeds/BreedSelectOptions";
import type { PublishedPointScheduleDivision } from "@/server/services/annualChampionshipPointSchedule.service";
import { getShowDistrictPresentationLabel } from "@showring/rules";

type PointScheduleTableClientProps = {
  divisions: readonly PublishedPointScheduleDivision[];
  showDistrictHeadings: boolean;
};

function ScheduleTable({ division, rows }: { division: PublishedPointScheduleDivision; rows: PublishedPointScheduleDivision["rows"] }) {
  return (
    <div id={`district-${division.district}`} className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
        <thead className="theme-label text-left text-xs uppercase tracking-[0.12em]">
          <tr>
            <th scope="col" rowSpan={2} className="sticky left-0 z-10 px-3 py-2 text-left">Breed</th>
            {[1, 2, 3, 4, 5].map((points) => <th key={points} scope="colgroup" colSpan={2} className="px-3 py-2 text-center">{points} Point{points === 1 ? "" : "s"}</th>)}
          </tr>
          <tr>
            {[1, 2, 3, 4, 5].flatMap((points) => [<th key={`${points}-dogs`} scope="col" className="px-3 py-2 text-right">Dogs</th>, <th key={`${points}-bitches`} scope="col" className="px-3 py-2 text-right">Bitches</th>])}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const dog = row.dogThresholds;
            const bitch = row.bitchThresholds;
            return <tr key={row.breedCode2} className="theme-card">
              <th scope="row" className="theme-heading sticky left-0 z-10 rounded-l-2xl px-3 py-3 text-left font-semibold">{row.breedName}</th>
              {[dog.one, bitch.one, dog.two, bitch.two, dog.three, bitch.three, dog.four, bitch.four, dog.five, bitch.five].map((value, index) => <td key={index} className={`px-3 py-3 text-right ${index === 9 ? "rounded-r-2xl" : ""}`}>{value.toLocaleString()}</td>)}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PointScheduleTableClient({ divisions, showDistrictHeadings }: PointScheduleTableClientProps) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [breedCode2, setBreedCode2] = useState("");
  const allRows = useMemo(() => divisions.flatMap((division) => division.rows), [divisions]);
  const groups = useMemo(() => [...new Set(allRows.map((row) => normalizeBreedGroupName(row.breedGroupName)))].sort(compareBreedGroupNames), [allRows]);
  const breedOptions = useMemo(() => [...new Map(allRows.map((row) => [row.breedCode2, row])).values()].filter((row) => !group || normalizeBreedGroupName(row.breedGroupName) === group).sort((left, right) => left.breedName.localeCompare(right.breedName)), [allRows, group]);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleDivisions = useMemo(() => divisions.map((division) => ({ ...division, rows: division.rows.filter((row) => (!normalizedSearch || row.breedName.toLocaleLowerCase().includes(normalizedSearch)) && (!group || normalizeBreedGroupName(row.breedGroupName) === group) && (!breedCode2 || row.breedCode2 === breedCode2)) })).filter((division) => division.rows.length > 0), [breedCode2, divisions, group, normalizedSearch]);

  function handleGroupChange(nextGroup: string) {
    setGroup(nextGroup);
    if (breedCode2) {
      const currentBreed = allRows.find((row) => row.breedCode2 === breedCode2);
      if (currentBreed && nextGroup && normalizeBreedGroupName(currentBreed.breedGroupName) !== nextGroup) setBreedCode2("");
    }
  }

  return <div className="mt-6">
    <div className="theme-card grid gap-4 rounded-2xl p-4 sm:grid-cols-3">
      <div>
        <label htmlFor="point-schedule-search" className="theme-copy mb-1 block text-xs font-semibold uppercase tracking-wide">Search</label>
        <input id="point-schedule-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search breeds" className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" />
      </div>
      <div>
        <label htmlFor="point-schedule-group" className="theme-copy mb-1 block text-xs font-semibold uppercase tracking-wide">Group</label>
        <select id="point-schedule-group" value={group} onChange={(event) => handleGroupChange(event.target.value)} className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <option value="">All Groups</option>
          {groups.map((groupName) => <option key={groupName} value={groupName}>{groupName}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="point-schedule-breed" className="theme-copy mb-1 block text-xs font-semibold uppercase tracking-wide">Breed</label>
        <select id="point-schedule-breed" value={breedCode2} onChange={(event) => setBreedCode2(event.target.value)} className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <option value="">All Breeds</option>
          {breedOptions.map((row) => <option key={row.breedCode2} value={row.breedCode2}>{row.breedName}</option>)}
        </select>
      </div>
    </div>
    {visibleDivisions.length === 0 ? <p className="theme-copy mt-6 text-sm">No breeds match these filters.</p> : <div className="mt-6 space-y-8">
      {visibleDivisions.map((division) => <section key={division.district}>
        {showDistrictHeadings ? <h3 className="theme-heading mb-3 text-xl font-semibold">{getShowDistrictPresentationLabel(division.district)}</h3> : null}
        <ScheduleTable division={division} rows={division.rows} />
      </section>)}
    </div>}
  </div>;
}
