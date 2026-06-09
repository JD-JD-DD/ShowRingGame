import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";

export type ServicesSearchParams = {
  message?: string | string[];
  error?: string | string[];
};

export function firstQueryValue(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function formatDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatNumber(value: number): string {
  return value.toFixed(2);
}

export function formatSignedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export async function getKennelServicesContext() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      balance: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  return { kennel };
}

export function ServicesHeader({
  title,
  description,
  balance,
  showWorkBoardLink = false,
}: {
  title: string;
  description: string;
  balance: number;
  showWorkBoardLink?: boolean;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-emerald-200/80">
          Kennel Services
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showWorkBoardLink ? (
          <Link
            href="/kennel/services"
            className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
          >
            Back to Work Board
          </Link>
        ) : null}
        <Link
          href="/kennel"
          className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
        >
          Back to My Kennel
        </Link>
        <div className="rounded-2xl border border-purple-300/15 bg-white/5 px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-purple-200">
            Balance
          </div>
          <div className="mt-1 text-xl font-semibold">
            {formatMoney(balance)}
          </div>
        </div>
      </div>
    </header>
  );
}

export function ServiceMessages({
  message,
  error,
}: {
  message: string | null;
  error: string | null;
}) {
  return (
    <>
      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-300/35 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}
    </>
  );
}
