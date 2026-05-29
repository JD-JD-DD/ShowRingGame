import Link from "next/link";
import { redirect } from "next/navigation";

import BulletinBadges from "@/components/bulletin/BulletinBadges";
import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  listBulletinCategories,
  listBulletinThreads,
} from "@/server/services/bulletin.service";

function formatEpoch(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BulletinPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          ownedDogs: true,
        },
      },
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const [categories, recentThreads] = await Promise.all([
    listBulletinCategories(),
    listBulletinThreads({ take: 8 }),
  ]);
  const canPost = kennel._count.ownedDogs > 0;

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">
              Player Bulletin Board
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Bulletin Board</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
              Talk with active kennels about shows, judges, wins, litters, stud
              ads, and game help.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/kennel"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              My Kennel
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Home
            </Link>
          </div>
        </header>

        {!canPost ? (
          <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            You can read the board now. Buy or own at least one dog to create
            threads and replies.
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Areas</h2>
            <div className="grid gap-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/bulletin/${category.slug}`}
                  className="rounded-[24px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition hover:border-purple-300/35 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {category.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-purple-100/70">
                        {category.description}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-purple-100">
                      {category.threadCount}
                    </div>
                  </div>

                  {category.latestThread ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-purple-100/70">
                      Latest:{" "}
                      <span className="font-semibold text-white">
                        {category.latestThread.title}
                      </span>
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
            {recentThreads.length === 0 ? (
              <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-purple-100/70">
                No bulletin threads yet.
              </section>
            ) : (
              <div className="grid gap-4">
                {recentThreads.map((thread) => (
                  <article
                    key={thread.id}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)] transition hover:border-purple-300/35 hover:bg-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-purple-100/60">
                      <span>{thread.category.name}</span>
                      <span>-</span>
                      <span>{formatEpoch(thread.lastActivityEpoch)}</span>
                      <span>-</span>
                      <span>{thread.replyCount} replies</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      <Link
                        href={`/bulletin/thread/${thread.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {thread.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-purple-100/72">
                      {thread.preview}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/kennels/${thread.kennel.slug}`}
                        className="text-sm font-semibold text-purple-100 underline-offset-4 hover:underline"
                      >
                        {thread.kennel.name}
                      </Link>
                      <BulletinBadges badges={thread.badges} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
