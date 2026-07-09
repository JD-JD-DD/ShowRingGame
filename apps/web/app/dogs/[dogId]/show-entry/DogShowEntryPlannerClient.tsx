"use client";

import { useMemo, useState, type ReactNode } from "react";

import type {
  DogShowEntryPlannerClusterDto,
  DogShowEntryPlannerDayDto,
  DogShowEntryPlannerDto,
  DogShowEntryQuotePreviewDto,
} from "@/server/services/dogShowEntryPlanner.service";

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function badgeTone(tone: "green" | "amber" | "red" | "sky" | "neutral") {
  switch (tone) {
    case "green":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "amber":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "red":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    case "sky":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "neutral":
      return "theme-neutral-badge";
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--dog-border)] bg-purple-500/10 px-3 py-2">
      <div className="theme-label text-[0.68rem] uppercase tracking-[0.14em]">
        {label}
      </div>
      <div className="theme-heading mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "green" | "amber" | "red" | "sky" | "neutral";
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeTone(
        tone
      )}`}
    >
      {children}
    </span>
  );
}

function selectionKey(clusterId: string, showDayId: string): string {
  return `${clusterId}:${showDayId}`;
}

function getSelectedDayCount(
  cluster: DogShowEntryPlannerClusterDto,
  selected: Set<string>
): number {
  return cluster.days.filter((day) =>
    selected.has(selectionKey(cluster.showId, day.showDayId))
  ).length;
}

function getSelectedClusterEstimate(args: {
  quote: DogShowEntryQuotePreviewDto;
  selectedDayCount: number;
}): number {
  const { quote, selectedDayCount } = args;

  if (!quote || selectedDayCount === 0 || quote.selectedDayCount === 0) {
    return 0;
  }

  const perDayEntryFee = quote.entryFees / quote.selectedDayCount;

  return (
    perDayEntryFee * selectedDayCount + quote.travelCost + quote.handlerFee
  );
}

function QuotePreview({
  quote,
  selectedDayCount,
}: {
  quote: DogShowEntryQuotePreviewDto;
  selectedDayCount: number;
}) {
  if (!quote) {
    return (
      <div className="theme-copy rounded-xl border border-[var(--dog-border)] bg-black/10 px-3 py-2 text-sm">
        No selectable days in this show, so no cost preview is available.
      </div>
    );
  }

  const selectedEstimate = getSelectedClusterEstimate({ quote, selectedDayCount });

  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <DetailRow label="Preview Days" value={quote.selectedDayCount} />
      <DetailRow label="Entry Fees" value={formatMoney(quote.entryFees)} />
      <DetailRow label="Travel" value={formatMoney(quote.travelCost)} />
      <DetailRow label="Handler" value={formatMoney(quote.handlerFee)} />
      <DetailRow
        label="All-Selectable Total"
        value={formatMoney(quote.estimatedTotalCost)}
      />
      <DetailRow
        label="Selected Estimate"
        value={selectedDayCount > 0 ? formatMoney(selectedEstimate) : "$0"}
      />
      <DetailRow
        label="Travel Status"
        value={quote.travelCostAlreadyCovered ? "Already covered" : "New trip"}
      />
      <DetailRow
        label="Entry Type"
        value={quote.isSecondaryEntry ? "Travel entry" : "Primary show entry"}
      />
    </div>
  );
}

function DaySelector({
  clusterId,
  day,
  checked,
  onToggle,
}: {
  clusterId: string;
  day: DogShowEntryPlannerDayDto;
  checked: boolean;
  onToggle: (key: string, checked: boolean) => void;
}) {
  const tone = day.canSelect
    ? "green"
    : day.alreadyEntered
      ? "sky"
      : day.sameWeekendConflict
        ? "amber"
        : "neutral";
  const key = selectionKey(clusterId, day.showDayId);

  return (
    <label
      className={`block rounded-xl border px-3 py-3 ${
        day.canSelect
          ? checked
            ? "border-emerald-200/60 bg-emerald-500/20"
            : "border-emerald-300/30 bg-emerald-500/10"
          : "border-[var(--dog-border)] bg-black/10 opacity-75"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 gap-3">
          <input
            type="checkbox"
            checked={checked}
            disabled={!day.canSelect}
            onChange={(event) => onToggle(key, event.target.checked)}
            className="mt-1 h-5 w-5 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Select day ${day.dayIndex}`}
          />
          <div>
            <div className="theme-heading text-sm font-semibold">
              Day {day.dayIndex}
            </div>
            <div className="theme-copy mt-0.5 text-xs">{day.label}</div>
            <div className="theme-copy mt-0.5 text-xs">
              Judge: {day.judgeName}
            </div>
          </div>
        </div>
        <StatusBadge tone={tone}>
          {day.canSelect
            ? "Selectable"
            : day.alreadyEntered
              ? "Entered"
              : "Unavailable"}
        </StatusBadge>
      </div>
      {day.disabledReason ? (
        <div className="mt-2 text-xs font-medium text-[var(--dog-copy)]">
          {day.disabledReason}
        </div>
      ) : null}
      {day.sameWeekendConflict ? (
        <div className="mt-2 text-xs text-amber-100">
          Same-weekend conflict: {day.sameWeekendConflict.clusterName}
        </div>
      ) : null}
    </label>
  );
}

function ShowClusterCard({
  cluster,
  selected,
  onToggle,
}: {
  cluster: DogShowEntryPlannerClusterDto;
  selected: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
}) {
  const selectedDayCount = getSelectedDayCount(cluster, selected);
  const hasSelection = selectedDayCount > 0;

  return (
    <article
      className={`theme-card rounded-2xl p-4 ${
        cluster.hasSelectableDays ? "" : "opacity-80"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="theme-heading text-xl font-semibold">
              {cluster.name}
            </h2>
            <StatusBadge tone={cluster.hasSelectableDays ? "green" : "neutral"}>
              {cluster.hasSelectableDays
                ? "Selectable days"
                : "No selectable days"}
            </StatusBadge>
            {hasSelection ? (
              <StatusBadge tone="green">{selectedDayCount} selected</StatusBadge>
            ) : null}
            {cluster.dogAlreadyEnteredInCluster ? (
              <StatusBadge tone="sky">Dog entered</StatusBadge>
            ) : null}
            {cluster.kennelRepresentedInCluster ? (
              <StatusBadge tone="sky">Kennel represented</StatusBadge>
            ) : null}
          </div>
          <div className="theme-copy mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span>{cluster.weekendKey}</span>
            <span>{cluster.districtName}</span>
            <span>{cluster.entryStatusMessage}</span>
          </div>
        </div>
      </div>

      {cluster.entryImpact.notice ? (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            hasSelection
              ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
              : "border-sky-300/25 bg-sky-500/10 text-sky-100"
          }`}
        >
          {cluster.entryImpact.notice}
        </div>
      ) : null}

      {cluster.disabledReason ? (
        <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {cluster.disabledReason}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cluster.days.map((day) => {
          const key = selectionKey(cluster.showId, day.showDayId);

          return (
            <DaySelector
              key={day.showDayId}
              clusterId={cluster.showId}
              day={day}
              checked={selected.has(key)}
              onToggle={onToggle}
            />
          );
        })}
      </div>

      <div className="mt-4 border-t border-[var(--dog-border)] pt-4">
        <div className="theme-label mb-2 text-xs uppercase tracking-[0.14em]">
          Cost Preview
        </div>
        <QuotePreview
          quote={cluster.quotePreview}
          selectedDayCount={selectedDayCount}
        />
      </div>
    </article>
  );
}

function getSelectedSummary(args: {
  clusters: DogShowEntryPlannerClusterDto[];
  selected: Set<string>;
}) {
  let selectedDayCount = 0;
  let estimatedTotalCost = 0;
  const selectedClusterIds = new Set<string>();

  for (const cluster of args.clusters) {
    const clusterSelectedDayCount = getSelectedDayCount(cluster, args.selected);

    if (clusterSelectedDayCount === 0) {
      continue;
    }

    selectedDayCount += clusterSelectedDayCount;
    selectedClusterIds.add(cluster.showId);
    estimatedTotalCost += getSelectedClusterEstimate({
      quote: cluster.quotePreview,
      selectedDayCount: clusterSelectedDayCount,
    });
  }

  return {
    selectedDayCount,
    selectedClusterCount: selectedClusterIds.size,
    estimatedTotalCost,
  };
}

export function DogShowEntryPlannerClient({
  planner,
}: {
  planner: DogShowEntryPlannerDto;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(
    () => getSelectedSummary({ clusters: planner.clusters, selected }),
    [planner.clusters, selected]
  );

  function handleToggle(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }

      return next;
    });
    setMessage(null);
  }

  return (
    <section className="dog-panel rounded-[28px] px-5 py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="theme-label text-xs uppercase tracking-[0.18em]">
            Open Shows
          </p>
          <h2 className="theme-heading mt-2 text-3xl font-bold tracking-tight">
            Entry Planner
          </h2>
          <p className="theme-copy mt-2 max-w-2xl text-sm leading-6">
            Select eligible show days to preview the estimated entry cost.
            Submission is not wired yet.
          </p>
        </div>
        <div className="theme-neutral-badge rounded-full px-3 py-1 text-sm">
          {planner.clusters.length} open show
          {planner.clusters.length === 1 ? "" : "s"}
        </div>
      </div>

      {planner.clusters.length === 0 ? (
        <div className="theme-card theme-copy mt-6 rounded-2xl px-4 py-5 text-sm">
          No shows are currently open for entry.
        </div>
      ) : (
        <>
          <div className="theme-card mt-6 rounded-2xl p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <DetailRow
                  label="Selected Days"
                  value={summary.selectedDayCount}
                />
                <DetailRow
                  label="Selected Shows"
                  value={summary.selectedClusterCount}
                />
                <DetailRow
                  label="Estimated Total"
                  value={formatMoney(summary.estimatedTotalCost)}
                />
              </div>
              <button
                type="button"
                disabled={summary.selectedDayCount === 0}
                onClick={() =>
                  setMessage("Entry submission will be enabled in the next step.")
                }
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-[color:var(--dog-card)] disabled:text-[color:var(--dog-copy)]"
              >
                Enter Selected Shows
              </button>
            </div>
            <div className="theme-copy mt-3 text-xs leading-5">
              Estimated cost is based on selected days. Entry fees are prorated
              from the planner preview; travel and handler charges are included
              once per selected show when present. Final travel and primary-show
              charges will be confirmed before entry.
            </div>
            {message ? (
              <div className="mt-3 rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
                {message}
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4">
            {planner.clusters.map((cluster) => (
              <ShowClusterCard
                key={cluster.showId}
                cluster={cluster}
                selected={selected}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
