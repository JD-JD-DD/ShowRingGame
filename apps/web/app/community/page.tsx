import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityAuthor from "@/components/community/CommunityAuthor";
import { epochToDate } from "@/lib/gameClock";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";
import {
  getCommunityActor,
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

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const perf = createPerfTimer({ route: "/community" });
  const userId = await perf.measure("sessionMs", () => getSessionUserId());
  if (!userId) redirect("/login?next=/community");

  const actor = await perf.measure("actorMs", () => getCommunityActor(userId));
  if (!actor.kennel) redirect("/onboarding");

  const { error, saved } = await searchParams;
  const [categories, recentTopics] = await perf.measure("communityListsMs", () =>
    Promise.all([
      listBulletinCategories({
        includeInactive: actor.isAdmin,
        includeModerated: actor.isAdmin,
      }),
      listBulletinThreads({ take: 8, includeModerated: actor.isAdmin }),
    ])
  );
  const canPost = actor.isAdmin || actor.kennel.ownedDogCount > 0;
  perf.log({
    userContextPresent: true,
    kennelContextPresent: true,
    categoryCount: categories.length,
    recentTopicCount: recentTopics.length,
    ownedDogCount: actor.kennel.ownedDogCount,
    payloadSizeBytes: estimateJsonSizeBytes({ categories, recentTopics }),
  });

  return (
    <main className="community-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="theme-panel mb-8 flex flex-col gap-4 rounded-[28px] px-6 py-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.25em]">ShowRing Community</p>
            <h1 className="theme-heading mt-2 text-3xl font-semibold">Community</h1>
            <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
              Talk with other kennels about shows, breeding programs, wins, litters, and game help.
            </p>
          </div>
          <Link href="/kennel" className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold">
            My Kennel
          </Link>
        </header>

        {error ? <p className="mb-6 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        {saved ? <p className="mb-6 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">Community settings saved.</p> : null}
        {!canPost ? <p className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">You can read the community now. Own at least one dog before creating topics or replies.</p> : null}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Categories</h2>
            <div className="grid gap-4">
              {categories.filter((category) => category.isActive || actor.isAdmin).map((category) => (
                <Link key={category.id} href={`/community/${category.slug}`} className="theme-card-interactive rounded-[24px] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="theme-heading text-lg font-semibold">{category.name}</h3>
                        {!category.isActive ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-amber-100">Inactive</span> : null}
                        {category.topicCreationPolicy === "ADMINS" ? <span className="rounded-full bg-fuchsia-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-fuchsia-100">Announcements</span> : null}
                      </div>
                      <p className="theme-copy mt-2 text-sm leading-6">{category.description}</p>
                    </div>
                    <span className="theme-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">{category.threadCount}</span>
                  </div>
                  {category.latestThread ? <p className="theme-card theme-copy mt-4 rounded-2xl px-4 py-3 text-sm">Latest: <span className="theme-heading font-semibold">{category.latestThread.title}</span></p> : null}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-xl font-semibold">Recent activity</h2>
            <div className="grid gap-4">
              {recentTopics.map((topic) => (
                <article key={topic.id} className="theme-card rounded-[24px] p-5">
                  <div className="theme-label flex flex-wrap items-center gap-2 text-xs">
                    {topic.pinned ? <span>Pinned ·</span> : null}
                    {topic.status !== "OPEN" ? <span>{topic.status} ·</span> : null}
                    <span>{topic.category.name}</span><span>·</span><span>{formatEpoch(topic.lastActivityEpoch)}</span><span>·</span><span>{topic.replyCount} replies</span>
                  </div>
                  <h3 className="theme-heading mt-2 text-lg font-semibold"><Link href={`/community/${topic.category.slug}/${topic.id}`} className="hover:underline">{topic.title}</Link></h3>
                  <p className="theme-copy mt-2 text-sm leading-6">{topic.preview}</p>
                  <div className="mt-4"><CommunityAuthor kennel={topic.kennel} badges={topic.badges} /></div>
                </article>
              ))}
              {recentTopics.length === 0 ? <p className="theme-card theme-copy rounded-[24px] p-6 text-sm">No community topics yet.</p> : null}
            </div>
          </div>
        </section>

        {actor.isAdmin ? (
          <section className="theme-panel mt-10 rounded-[28px] p-6">
            <h2 className="theme-heading text-2xl font-semibold">Category administration</h2>
            <p className="theme-copy mt-2 text-sm">Changes here affect the existing community records. Disabling a category preserves all of its topics.</p>
            <div className="mt-6 grid gap-5">
              {categories.map((category) => (
                <form key={category.id} action="/api/community/admin/categories" method="post" className="theme-card grid gap-3 rounded-2xl p-4 md:grid-cols-2">
                  <input type="hidden" name="id" value={category.id} />
                  <input name="name" defaultValue={category.name} required maxLength={60} className="theme-control rounded-xl px-3 py-2" />
                  <input name="slug" defaultValue={category.slug} required maxLength={60} className="theme-control rounded-xl px-3 py-2" />
                  <textarea name="description" defaultValue={category.description ?? ""} maxLength={240} rows={2} className="theme-control rounded-xl px-3 py-2 md:col-span-2" />
                  <label className="theme-copy grid gap-1 text-xs">Order<input name="sortOrder" type="number" defaultValue={category.sortOrder} className="theme-control rounded-xl px-3 py-2" /></label>
                  <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" value="true" defaultChecked={category.isActive} /> Active</label>
                  <label className="theme-copy grid gap-1 text-xs">Who can create topics<select name="topicCreationPolicy" defaultValue={category.topicCreationPolicy} className="theme-control rounded-xl px-3 py-2"><option value="MEMBERS">Members</option><option value="ADMINS">Admins</option><option value="DISABLED">Disabled</option></select></label>
                  <label className="theme-copy grid gap-1 text-xs">Who can reply<select name="replyPolicy" defaultValue={category.replyPolicy} className="theme-control rounded-xl px-3 py-2"><option value="MEMBERS">Members</option><option value="ADMINS">Admins</option><option value="DISABLED">Disabled</option></select></label>
                  <div className="md:col-span-2"><button className="rounded-xl bg-fuchsia-700 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-600">Save {category.name}</button></div>
                </form>
              ))}
              <form action="/api/community/admin/categories" method="post" className="theme-card grid gap-3 rounded-2xl border-dashed p-4 md:grid-cols-2">
                <h3 className="font-semibold md:col-span-2">Create category</h3>
                <input name="name" placeholder="Category name" required maxLength={60} className="theme-control rounded-xl px-3 py-2" />
                <input name="slug" placeholder="category-slug" required maxLength={60} className="theme-control rounded-xl px-3 py-2" />
                <textarea name="description" placeholder="Description" maxLength={240} rows={2} className="theme-control rounded-xl px-3 py-2 md:col-span-2" />
                <input name="sortOrder" type="number" defaultValue={categories.length * 10 + 10} className="theme-control rounded-xl px-3 py-2" />
                <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" value="true" defaultChecked /> Active</label>
                <select name="topicCreationPolicy" defaultValue="MEMBERS" className="theme-control rounded-xl px-3 py-2"><option value="MEMBERS">Member topics</option><option value="ADMINS">Admin topics</option><option value="DISABLED">Topics disabled</option></select>
                <select name="replyPolicy" defaultValue="MEMBERS" className="theme-control rounded-xl px-3 py-2"><option value="MEMBERS">Member replies</option><option value="ADMINS">Admin replies</option><option value="DISABLED">Replies disabled</option></select>
                <div className="md:col-span-2"><button className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">Create category</button></div>
              </form>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
