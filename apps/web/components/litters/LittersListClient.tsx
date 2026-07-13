"use client";

import { useState } from "react";

import { EmptyLittersState, LitterCards } from "@/components/litters/LitterCards";
import type { LitterListItemDto } from "@/server/mappers/litter.mapper";
import type { LitterListCursor } from "@/server/services/litter.service";

type LitterPageResponse = {
  ok: boolean;
  litters?: LitterListItemDto[];
  nextCursor?: LitterListCursor | null;
  hasMore?: boolean;
  error?: string;
};

const DEFAULT_LOAD_ERROR =
  "We couldn't load more litters right now. Please try again.";

export function LittersListClient(props: {
  initialLitters: LitterListItemDto[];
  initialCursor: LitterListCursor | null;
  initialHasMore: boolean;
}) {
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

  return (
    <div className="grid gap-5">
      <p aria-live="polite" className="sr-only">
        {isLoadingMore
          ? "Loading more litters."
          : errorMessage
            ? errorMessage
            : hasMore
              ? `${litters.length} litters loaded.`
              : "All litters loaded."}
      </p>

      {litters.length === 0 ? <EmptyLittersState /> : <LitterCards litters={litters} />}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
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
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:bg-[color:var(--dog-card)] disabled:text-[color:var(--dog-copy)]"
          >
            {isLoadingMore ? "Loading More Litters..." : "See More Litters"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
