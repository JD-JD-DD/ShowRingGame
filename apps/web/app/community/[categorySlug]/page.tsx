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
    <main className="community-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="theme-label text-sm uppercase tracking-[0.25em]">Community</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="theme-heading text-3xl font-semibold">{category.name}</h1>
                {!category.isActive ? <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase text-amber-100">Inactive</span> : null}
              </div>
              <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">{category.description}</p>
            </div>
            <Link href="/community" className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold">All categories</Link>
          </div>
        </header>

        {error ? <p className="mb-6 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}

        <section className="theme-panel mb-8 rounded-[24px] p-5">
          <h2 className="theme-heading text-xl font-semibold">Start a topic</h2>
          {canCreateTopic ? (
            <form action="/api/bulletin/threads" method="post" className="mt-5 grid gap-4">
              <input type="hidden" name="categorySlug" value={category.slug} />
              <input name="title" type="text" maxLength={90} required placeholder="Topic title" className="theme-control rounded-2xl px-4 py-3 outline-none" />
              <textarea name="body" required maxLength={5000} rows={5} placeholder="What would you like to share?" className="theme-control rounded-2xl px-4 py-3 leading-7 outline-none" />
              <div><button className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-500">Post topic</button></div>
            </form>
          ) : (
            <p className="theme-copy mt-3 text-sm leading-7">
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
              <article key={topic.id} className="theme-card rounded-[24px] p-5">
                <div className="theme-label flex flex-wrap items-center gap-2 text-xs">
                  {topic.pinned ? <span className="text-amber-200">Pinned ·</span> : null}
                  {topic.status !== "OPEN" ? <span className="text-fuchsia-200">{topic.status} ·</span> : null}
                  <span>{formatEpoch(topic.lastActivityEpoch)}</span><span>·</span><span>{topic.replyCount} replies</span>
                </div>
                <h3 className="theme-heading mt-2 text-lg font-semibold"><Link href={`/community/${category.slug}/${topic.id}`} className="hover:underline">{topic.title}</Link></h3>
                <p className="theme-copy mt-2 text-sm leading-6">{topic.preview}</p>
                <div className="mt-4"><CommunityAuthor kennel={topic.kennel} badges={topic.badges} /></div>
              </article>
            ))}
            {topics.length === 0 ? <p className="theme-card theme-copy rounded-[24px] p-6 text-sm">No topics in this category yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
