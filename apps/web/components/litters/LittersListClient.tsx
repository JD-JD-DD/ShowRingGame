"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { EmptyLittersState, LitterCards } from "@/components/litters/LitterCards";
import type { LitterListItemDto } from "@/server/mappers/litter.mapper";
import type {
  LitterArchiveFilters,
  LitterListCursor,
  LitterManagementOptions,
} from "@/server/services/litter.service";

type LitterPageResponse = {
  ok: boolean;
  litters?: LitterListItemDto[];
  nextCursor?: LitterListCursor | null;
  hasMore?: boolean;
  error?: string;
};

const DEFAULT_LOAD_ERROR =
  "We couldn't load more litters right now. Please try again.";

const focusControlClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";

export function LittersListClient(props: {
  initialLitters: LitterListItemDto[];
  initialCursor: LitterListCursor | null;
  initialHasMore: boolean;
  filters: LitterArchiveFilters;
  managementOptions: LitterManagementOptions;
  hasHistoricalLitters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [litters, setLitters] = useState(props.initialLitters);
  const [nextCursor, setNextCursor] = useState<LitterListCursor | null>(
    props.initialCursor
  );
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLoadMore() {
    if (!hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/litters/page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cursor: nextCursor,
          filters: props.filters,
        }),
      });
      const payload = (await response.json()) as LitterPageResponse;

      if (!response.ok || !payload.ok || !payload.litters) {
        throw new Error(payload.error || DEFAULT_LOAD_ERROR);
      }

      const nextLitters = payload.litters;

      setLitters((current) => [...current, ...nextLitters]);
      setNextCursor(payload.nextCursor ?? null);
      setHasMore(payload.hasMore === true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : DEFAULT_LOAD_ERROR
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    const search = String(formData.get("search") ?? "").trim();
    const breedCode2 = String(formData.get("breedCode2") ?? "");
    const year = String(formData.get("year") ?? "");
    const sort = String(formData.get("sort") ?? "newest");

    if (search) params.set("search", search);
    if (breedCode2) params.set("breedCode2", breedCode2);
    if (year) params.set("year", year);
    if (sort === "oldest") params.set("sort", sort);
    router.push(`${pathname}${params.size > 0 ? `?${params.toString()}` : ""}`);
  }

  const hasActiveFilters =
    props.filters.search.length > 0 ||
    props.filters.breedCode2 !== null ||
    props.filters.gameYear !== null ||
    props.filters.sort !== "newest";

  return (
    <div className="grid gap-5">
      <form
        className="theme-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto_auto] lg:items-end"
        action={applyFilters}
      >
        <label className="theme-heading grid gap-1 text-sm font-medium">
          Search litters
          <input
            name="search"
            type="search"
            defaultValue={props.filters.search}
            placeholder="Parents, puppies, or litter serial"
            className={`theme-control rounded-xl px-3 py-2 text-sm ${focusControlClass}`}
          />
        </label>
        <label className="theme-heading grid gap-1 text-sm font-medium">
          Breed
          <select
            name="breedCode2"
            defaultValue={props.filters.breedCode2 ?? ""}
            className={`theme-control rounded-xl px-3 py-2 text-sm ${focusControlClass}`}
          >
            <option value="">All breeds</option>
            {props.managementOptions.breeds.map((breed) => (
              <option key={breed.code2} value={breed.code2}>
                {breed.name} ({breed.code2})
              </option>
            ))}
          </select>
        </label>
        <label className="theme-heading grid gap-1 text-sm font-medium">
          Year
          <select
            name="year"
            defaultValue={props.filters.gameYear?.toString() ?? ""}
            className={`theme-control rounded-xl px-3 py-2 text-sm ${focusControlClass}`}
          >
            <option value="">All years</option>
            {props.managementOptions.years.map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </select>
        </label>
        <label className="theme-heading grid gap-1 text-sm font-medium">
          Sort
          <select
            name="sort"
            defaultValue={props.filters.sort}
            className={`theme-control rounded-xl px-3 py-2 text-sm ${focusControlClass}`}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button
          type="submit"
          className={`theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold ${focusControlClass}`}
        >
          Apply
        </button>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className={`theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold ${focusControlClass}`}
          >
            Clear filters
          </button>
        ) : null}
      </form>
      <p aria-live="polite" className="sr-only">
        {isLoadingMore
          ? "Loading more litters."
          : errorMessage
            ? errorMessage
            : hasMore
              ? `${litters.length} litters loaded.`
              : "All litters loaded."}
      </p>

      {litters.length === 0 ? (
        props.hasHistoricalLitters ? (
          <div className="theme-card rounded-2xl p-8 text-center">
            <h3 className="theme-heading text-xl font-semibold">No litters match these filters</h3>
            <button
              type="button"
              onClick={() => router.push(pathname)}
              className={`theme-primary-button mt-5 rounded-xl px-5 py-3 text-sm font-semibold ${focusControlClass}`}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <EmptyLittersState />
        )
      ) : <LitterCards litters={litters} />}

      {errorMessage ? (
        <p
          role="alert"
          className="theme-status-warning rounded-xl px-4 py-3 text-sm"
        >
          {errorMessage}
        </p>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="theme-primary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-subtle)] disabled:text-[var(--color-text-disabled)]"
          >
            {isLoadingMore ? "Loading More Litters..." : "See More Litters"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
