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
        <p className="theme-label text-sm uppercase tracking-[0.25em]">
          Kennel Services
        </p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">{title}</h1>
        <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showWorkBoardLink ? (
          <Link
            href="/kennel/services"
            className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Back to Work Board
          </Link>
        ) : null}
        <Link
          href="/kennel"
          className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
        >
          Back to My Kennel
        </Link>
        <div className="theme-card rounded-2xl px-5 py-4">
          <div className="theme-label text-xs uppercase tracking-wide">
            Balance
          </div>
          <div className="theme-heading mt-1 text-xl font-semibold">
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
        <div className="theme-status-success mb-5 rounded-2xl px-5 py-4 text-sm font-semibold">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="theme-status-danger mb-5 rounded-2xl px-5 py-4 text-sm font-semibold">
          {error}
        </div>
      ) : null}
    </>
  );
}
