import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

type KennelDirectoryRow = {
  id: string;
  name: string;
  slug: string;
  lastLoginAt: Date | null;
};

function formatLastActive(lastLoginAt: Date | null | undefined): string {
  if (!lastLoginAt) {
    return "Last active unknown";
  }

  return `Last active ${lastLoginAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

export default async function AllKennelsPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennels = await db.$queryRaw<KennelDirectoryRow[]>`
    SELECT
      kennel."id",
      kennel."name",
      kennel."slug",
      "user"."lastLoginAt"
    FROM "Kennel" kennel
    LEFT JOIN "User" "user" ON "user"."id" = kennel."userId"
    WHERE kennel."isNpc" = false
    ORDER BY kennel."name" ASC
  `;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 text-white">
      <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">
              Show Districts
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              All Kennels
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Browse all player kennels across ShowRing.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/travel-map"
              className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              District Map
            </Link>
            <Link
              href="/shows"
              className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              All Shows
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

      <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Player Kennels
            </h2>
            <p className="mt-2 text-sm text-purple-100/70">
              {kennels.length} kennel{kennels.length === 1 ? "" : "s"} listed.
            </p>
          </div>
        </div>

        {kennels.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-purple-100/65">
            No player kennels have been created yet.
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-2">
              {kennels.map((kennel) => (
                <Link
                  key={kennel.id}
                  href={`/kennels/${kennel.slug}`}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm transition hover:border-fuchsia-300/35 hover:bg-white/10"
                >
                  <span className="font-semibold text-white">
                    {kennel.name}
                  </span>
                  <span className="text-purple-100/60"> &middot; </span>
                  <span className="text-purple-100/75">
                    {formatLastActive(kennel.lastLoginAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
