import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BulletinBadges from "@/components/bulletin/BulletinBadges";
import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getBulletinThread } from "@/server/services/bulletin.service";

type PageProps = {
  params: Promise<{
    threadId: string;
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
  return epochToDate(epoch).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function BulletinThreadPage({
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

  const { threadId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = firstQueryValue(resolvedSearchParams.error);
  const thread = await getBulletinThread(threadId);

  if (!thread) {
    notFound();
  }

  const canReply = kennel._count.ownedDogs > 0 && thread.status === "OPEN";

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-purple-100/60">
                <Link
                  href="/bulletin"
                  className="font-semibold text-purple-100 underline-offset-4 hover:underline"
                >
                  Bulletin Board
                </Link>
                <span>-</span>
                <Link
                  href={`/bulletin/${thread.category.slug}`}
                  className="font-semibold text-purple-100 underline-offset-4 hover:underline"
                >
                  {thread.category.name}
                </Link>
              </div>
              <h1 className="mt-3 text-3xl font-semibold">{thread.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-purple-100">
                  {thread.kennel.name}
                </span>
                <BulletinBadges badges={thread.badges} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/bulletin/${thread.category.slug}`}
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Back to Area
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

        <section className="grid gap-4">
          {thread.posts.map((post, index) => (
            <article
              key={post.id}
              className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-white">
                    {post.kennel.name}
                  </span>
                  <BulletinBadges badges={post.badges} />
                </div>
                <div className="text-xs text-purple-100/60">
                  {index === 0 ? "Original post" : "Reply"} -{" "}
                  {formatEpoch(post.createdAtEpoch)}
                </div>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-purple-100/80">
                {post.body}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[24px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <h2 className="text-xl font-semibold text-white">Reply</h2>
          {canReply ? (
            <form
              action={`/api/bulletin/threads/${thread.id}/posts`}
              method="post"
              className="mt-5 grid gap-4"
            >
              <textarea
                name="body"
                required
                maxLength={5000}
                rows={5}
                placeholder="Write a reply..."
                className="rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-purple-100/40"
              />
              <div>
                <button
                  type="submit"
                  className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  Post Reply
                </button>
              </div>
            </form>
          ) : thread.status !== "OPEN" ? (
            <p className="mt-3 text-sm text-purple-100/70">
              This thread is locked.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-purple-100/70">
              You need to own at least one dog before replying on the Bulletin
              Board.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
