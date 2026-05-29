import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BulletinBadges from "@/components/bulletin/BulletinBadges";
import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  getBulletinCategory,
  listBulletinThreads,
} from "@/server/services/bulletin.service";

type PageProps = {
  params: Promise<{
    categorySlug: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatEpoch(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BulletinCategoryPage({
  params,
  searchParams,
}: PageProps) {
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

  const { categorySlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = firstQueryValue(resolvedSearchParams.error);
  const [category, threads] = await Promise.all([
    getBulletinCategory(categorySlug),
    listBulletinThreads({ categorySlug }),
  ]);

  if (!category) {
    notFound();
  }

  const canPost = kennel._count.ownedDogs > 0;

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">
                Bulletin Board
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{category.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
                {category.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/bulletin"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                All Areas
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

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mb-8 rounded-[24px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <h2 className="text-xl font-semibold text-white">Start a Thread</h2>
          {canPost ? (
            <form action="/api/bulletin/threads" method="post" className="mt-5 grid gap-4">
              <input type="hidden" name="categorySlug" value={category.slug} />
              <input
                name="title"
                type="text"
                maxLength={90}
                required
                placeholder="Thread title"
                className="rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-purple-100/40"
              />
              <textarea
                name="body"
                required
                maxLength={5000}
                rows={5}
                placeholder="What would you like to share?"
                className="rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-purple-100/40"
              />
              <div>
                <button
                  type="submit"
                  className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  Post Thread
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-3 text-sm leading-7 text-purple-100/70">
              You need to own at least one dog before posting on the Bulletin
              Board.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Threads</h2>
          {threads.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-purple-100/70">
              No threads in this area yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {threads.map((thread) => (
                <article
                  key={thread.id}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)] transition hover:border-purple-300/35 hover:bg-white/10"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-purple-100/60">
                    {thread.pinned ? <span>Pinned</span> : null}
                    {thread.pinned ? <span>-</span> : null}
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
        </section>
      </div>
    </main>
  );
}
