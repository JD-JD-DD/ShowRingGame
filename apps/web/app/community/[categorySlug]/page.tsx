import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CommunityAuthor from "@/components/community/CommunityAuthor";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  getBulletinCategory,
  getCommunityActor,
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

function policyAllows(policy: string, isAdmin: boolean): boolean {
  return policy === "MEMBERS" || (policy === "ADMINS" && isAdmin);
}

export default async function CommunityCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const actor = await getCommunityActor(userId);
  if (!actor.kennel) redirect("/onboarding");

  const { categorySlug } = await params;
  const { error } = await searchParams;
  const [category, topics] = await Promise.all([
    getBulletinCategory(categorySlug, { includeInactive: actor.isAdmin }),
    listBulletinThreads({
      categorySlug,
      includeInactive: actor.isAdmin,
      includeModerated: actor.isAdmin,
    }),
  ]);
  if (!category) notFound();

  const hasPostingKennel = actor.isAdmin || actor.kennel.ownedDogCount > 0;
  const canCreateTopic =
    hasPostingKennel && policyAllows(category.topicCreationPolicy, actor.isAdmin);

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">Community</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold">{category.name}</h1>
                {!category.isActive ? <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase text-amber-100">Inactive</span> : null}
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">{category.description}</p>
            </div>
            <Link href="/community" className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 hover:bg-white/10">All categories</Link>
          </div>
        </header>

        {error ? <p className="mb-6 rounded-2xl border border-red-300/25 bg-red-950/35 px-4 py-3 text-sm text-red-100">{error}</p> : null}

        <section className="mb-8 rounded-[24px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5">
          <h2 className="text-xl font-semibold">Start a topic</h2>
          {canCreateTopic ? (
            <form action="/api/bulletin/threads" method="post" className="mt-5 grid gap-4">
              <input type="hidden" name="categorySlug" value={category.slug} />
              <input name="title" type="text" maxLength={90} required placeholder="Topic title" className="rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-3 text-white outline-none" />
              <textarea name="body" required maxLength={5000} rows={5} placeholder="What would you like to share?" className="rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-3 leading-7 text-white outline-none" />
              <div><button className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold hover:bg-purple-500">Post topic</button></div>
            </form>
          ) : (
            <p className="mt-3 text-sm leading-7 text-purple-100/70">
              {category.topicCreationPolicy === "ADMINS"
                ? "Only administrators can start topics in this category."
                : category.topicCreationPolicy === "DISABLED"
                  ? "New topics are disabled in this category."
                  : "Own at least one dog before starting a topic."}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Topics</h2>
          <div className="grid gap-4">
            {topics.map((topic) => (
              <article key={topic.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
                <div className="flex flex-wrap items-center gap-2 text-xs text-purple-100/60">
                  {topic.pinned ? <span className="text-amber-200">Pinned ·</span> : null}
                  {topic.status !== "OPEN" ? <span className="text-fuchsia-200">{topic.status} ·</span> : null}
                  <span>{formatEpoch(topic.lastActivityEpoch)}</span><span>·</span><span>{topic.replyCount} replies</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold"><Link href={`/community/${category.slug}/${topic.id}`} className="hover:underline">{topic.title}</Link></h3>
                <p className="mt-2 text-sm leading-6 text-purple-100/72">{topic.preview}</p>
                <div className="mt-4"><CommunityAuthor kennel={topic.kennel} badges={topic.badges} /></div>
              </article>
            ))}
            {topics.length === 0 ? <p className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-purple-100/70">No topics in this category yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
