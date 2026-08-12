import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

type KennelDirectoryRow = {
  id: string;
  name: string;
  slug: string;
  lastActiveAt: Date | string | null;
};

function formatLastActive(lastActiveAt: Date | string | null | undefined): string {
  if (!lastActiveAt) {
    return "Last active unknown";
  }

  const lastActiveDate =
    lastActiveAt instanceof Date ? lastActiveAt : new Date(lastActiveAt);

  if (Number.isNaN(lastActiveDate.getTime())) {
    return "Last active unknown";
  }

  return `Last active ${lastActiveDate.toLocaleDateString("en-US", {
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
      "user"."lastActiveAt" AS "lastActiveAt"
    FROM "Kennel" kennel
    LEFT JOIN "User" "user" ON "user"."id" = kennel."userId"
    WHERE kennel."isNpc" = false
      AND kennel."moderationStatus" = 'ACTIVE'
    ORDER BY kennel."name" ASC
  `;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.25em]">
              Show Districts
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
              Player List
            </h1>
            <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
              Browse all player kennels across ShowRing.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/travel-map"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Travel Map
            </Link>
          </div>
        </div>
      </header>

      <section className="theme-panel rounded-[28px] p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="theme-heading text-2xl font-semibold">
              Player Kennels
            </h2>
            <p className="theme-copy mt-2 text-sm">
              {kennels.length} kennel{kennels.length === 1 ? "" : "s"} listed.
            </p>
          </div>
        </div>

        {kennels.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl px-4 py-5 text-sm">
            No player kennels have been created yet.
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-2">
              {kennels.map((kennel) => (
                <Link
                  key={kennel.id}
                  href={`/kennels/${kennel.slug}`}
                  className="theme-card-interactive rounded-2xl px-4 py-3 text-sm"
                >
                  <span className="theme-heading font-semibold">
                    {kennel.name}
                  </span>
                  <span className="theme-copy"> &middot; </span>
                  <span className="theme-copy">
                    {formatLastActive(kennel.lastActiveAt)}
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
