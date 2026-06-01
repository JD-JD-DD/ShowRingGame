"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  calculateBaseTravelCost,
  getDistanceTierLabel,
  getDistrictDistanceTier,
  SHOW_DISTRICT_REGIONS
} from "@showring/rules";
import { getDistrictBadgeStyle, getDistrictPanelStyle } from "@/lib/districtStyles";

const DISTRICT_ROUTE_ORDER = [1, 2, 3, 4, 5, 10, 9, 8, 7, 6, 11, 12, 13, 14, 15];

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

function getInitialDestination(homeDistrict: number): number {
  return homeDistrict === SHOW_DISTRICT_REGIONS.length
    ? homeDistrict - 1
    : homeDistrict + 1;
}

type TravelEstimate = {
  fromDistrict: number;
  toDistrict: number;
};

export default function DistrictTravelMap({
  homeDistrict,
  kennelCounts
}: {
  homeDistrict: number;
  kennelCounts: Record<number, number>;
}) {
  const [fromDistrict, setFromDistrict] = useState(homeDistrict);
  const [toDistrict, setToDistrict] = useState(getInitialDestination(homeDistrict));
  const [estimate, setEstimate] = useState<TravelEstimate | null>(null);

  function handleEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstimate({ fromDistrict, toDistrict });
  }

  const estimatedTier = estimate
    ? getDistrictDistanceTier(estimate.fromDistrict, estimate.toDistrict)
    : null;
  const estimatedCost = estimate
    ? calculateBaseTravelCost(estimate.fromDistrict, estimate.toDistrict)
    : null;

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 hidden p-10 lg:block">
          <svg
            aria-hidden="true"
            className="h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 1000 520"
          >
            <path
              d="M100 70 H900 V260 H100 V450 H900"
              fill="none"
              stroke="rgba(216, 180, 254, 0.28)"
              strokeDasharray="8 8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          </svg>
        </div>

        <div className="relative grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {DISTRICT_ROUTE_ORDER.map((district) => {
            const region = SHOW_DISTRICT_REGIONS[district - 1]!;
            const isHomeDistrict = district === homeDistrict;
            const kennelCount = kennelCounts[district] ?? 0;

            return (
              <Link
                key={district}
                href={`/districts/${district}`}
                style={getDistrictPanelStyle(region)}
                className="group min-h-36 rounded-2xl border p-4 transition hover:-translate-y-1 hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    style={getDistrictBadgeStyle(region)}
                    className="rounded-full border px-2.5 py-1 text-xs font-bold"
                  >
                    District {district}
                  </span>
                  {isHomeDistrict ? (
                    <span className="rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                      Your Kennel
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-4 text-lg font-semibold text-white transition group-hover:text-purple-100">
                  {region.shortName}
                </h2>
                <p className="mt-1 text-xs leading-5 text-purple-100/65">
                  {region.name}
                </p>
                <p className="mt-3 text-xs font-semibold text-purple-100/80">
                  {kennelCount} player kennel{kennelCount === 1 ? "" : "s"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
        <h2 className="text-2xl font-semibold text-white">Travel Expense</h2>
        <p className="mt-2 text-sm leading-6 text-purple-100/70">
          Estimate the base kennel travel cost used when entering shows. Dog
          transportation is added during entry planning.
        </p>

        <form
          onSubmit={handleEstimate}
          className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <label className="grid flex-1 gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-200/80">
              Travel expense from
            </span>
            <select
              value={fromDistrict}
              onChange={(event) => setFromDistrict(Number(event.target.value))}
              className="rounded-xl border border-purple-300/20 bg-[#15091f] px-4 py-3 text-sm text-white"
            >
              {SHOW_DISTRICT_REGIONS.map((region) => (
                <option key={region.district} value={region.district}>
                  District {region.district}: {region.shortName}
                </option>
              ))}
            </select>
          </label>

          <label className="grid flex-1 gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-200/80">
              To
            </span>
            <select
              value={toDistrict}
              onChange={(event) => setToDistrict(Number(event.target.value))}
              className="rounded-xl border border-purple-300/20 bg-[#15091f] px-4 py-3 text-sm text-white"
            >
              {SHOW_DISTRICT_REGIONS.map((region) => (
                <option key={region.district} value={region.district}>
                  District {region.district}: {region.shortName}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
          >
            Apply
          </button>
        </form>

        {estimate && estimatedTier !== null && estimatedCost !== null ? (
          <div className="mt-5 rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-4 text-sm text-purple-100/80">
            District {estimate.fromDistrict} to District {estimate.toDistrict}:{" "}
            <span className="font-semibold text-white">
              {getDistanceTierLabel(estimatedTier)}
            </span>{" "}
            travel, with a base kennel expense of{" "}
            <span className="font-semibold text-emerald-100">
              {formatMoney(estimatedCost)}
            </span>
            .
          </div>
        ) : null}
      </section>
    </>
  );
}
