import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityAuthor from "@/components/community/CommunityAuthor";
import { epochToDate } from "@/lib/gameClock";
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
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/community");

  const actor = await getCommunityActor(userId);
  if (!actor.kennel) redirect("/onboarding");

  const { error, saved } = await searchParams;
  const [categories, recentTopics] = await Promise.all([
    listBulletinCategories({
      includeInactive: actor.isAdmin,
      includeModerated: actor.isAdmin,
    }),
    listBulletinThreads({ take: 8, includeModerated: actor.isAdmin }),
  ]);
  const canPost = actor.isAdmin || actor.kennel.ownedDogCount > 0;

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">ShowRing Community</p>
            <h1 className="mt-2 text-3xl font-semibold">Community</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
              Talk with other kennels about shows, breeding programs, wins, litters, and game help.
            </p>
          </div>
          <Link href="/kennel" className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10">
            My Kennel
          </Link>
        </header>

        {error ? <p className="mb-6 rounded-2xl border border-red-300/25 bg-red-950/35 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        {saved ? <p className="mb-6 rounded-2xl border border-emerald-300/25 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">Community settings saved.</p> : null}
        {!canPost ? <p className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">You can read the community now. Own at least one dog before creating topics or replies.</p> : null}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Categories</h2>
            <div className="grid gap-4">
              {categories.filter((category) => category.isActive || actor.isAdmin).map((category) => (
                <Link key={category.id} href={`/community/${category.slug}`} className="rounded-[24px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition hover:border-purple-300/35">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{category.name}</h3>
                        {!category.isActive ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-amber-100">Inactive</span> : null}
                        {category.topicCreationPolicy === "ADMINS" ? <span className="rounded-full bg-fuchsia-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-fuchsia-100">Announcements</span> : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-purple-100/70">{category.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold">{category.threadCount}</span>
                  </div>
                  {category.latestThread ? <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-purple-100/70">Latest: <span className="font-semibold text-white">{category.latestThread.title}</span></p> : null}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-xl font-semibold">Recent activity</h2>
            <div className="grid gap-4">
              {recentTopics.map((topic) => (
                <article key={topic.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-purple-100/60">
                    {topic.pinned ? <span>Pinned ·</span> : null}
                    {topic.status !== "OPEN" ? <span>{topic.status} ·</span> : null}
                    <span>{topic.category.name}</span><span>·</span><span>{formatEpoch(topic.lastActivityEpoch)}</span><span>·</span><span>{topic.replyCount} replies</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold"><Link href={`/community/${topic.category.slug}/${topic.id}`} className="hover:underline">{topic.title}</Link></h3>
                  <p className="mt-2 text-sm leading-6 text-purple-100/72">{topic.preview}</p>
                  <div className="mt-4"><CommunityAuthor kennel={topic.kennel} badges={topic.badges} /></div>
                </article>
              ))}
              {recentTopics.length === 0 ? <p className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-purple-100/70">No community topics yet.</p> : null}
            </div>
          </div>
        </section>

        {actor.isAdmin ? (
          <section className="mt-10 rounded-[28px] border border-fuchsia-300/20 bg-fuchsia-950/20 p-6">
            <h2 className="text-2xl font-semibold">Category administration</h2>
            <p className="mt-2 text-sm text-purple-100/70">Changes here affect the existing community records. Disabling a category preserves all of its topics.</p>
            <div className="mt-6 grid gap-5">
              {categories.map((category) => (
                <form key={category.id} action="/api/community/admin/categories" method="post" className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-2">
                  <input type="hidden" name="id" value={category.id} />
                  <input name="name" defaultValue={category.name} required maxLength={60} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2" />
                  <input name="slug" defaultValue={category.slug} required maxLength={60} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2" />
                  <textarea name="description" defaultValue={category.description ?? ""} maxLength={240} rows={2} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 md:col-span-2" />
                  <label className="grid gap-1 text-xs text-purple-100/70">Order<input name="sortOrder" type="number" defaultValue={category.sortOrder} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white" /></label>
                  <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" value="true" defaultChecked={category.isActive} /> Active</label>
                  <label className="grid gap-1 text-xs text-purple-100/70">Who can create topics<select name="topicCreationPolicy" defaultValue={category.topicCreationPolicy} className="rounded-xl border border-white/15 bg-[#160b20] px-3 py-2 text-white"><option value="MEMBERS">Members</option><option value="ADMINS">Admins</option><option value="DISABLED">Disabled</option></select></label>
                  <label className="grid gap-1 text-xs text-purple-100/70">Who can reply<select name="replyPolicy" defaultValue={category.replyPolicy} className="rounded-xl border border-white/15 bg-[#160b20] px-3 py-2 text-white"><option value="MEMBERS">Members</option><option value="ADMINS">Admins</option><option value="DISABLED">Disabled</option></select></label>
                  <div className="md:col-span-2"><button className="rounded-xl bg-fuchsia-700 px-4 py-2 text-sm font-semibold hover:bg-fuchsia-600">Save {category.name}</button></div>
                </form>
              ))}
              <form action="/api/community/admin/categories" method="post" className="grid gap-3 rounded-2xl border border-dashed border-fuchsia-300/25 bg-black/20 p-4 md:grid-cols-2">
                <h3 className="font-semibold md:col-span-2">Create category</h3>
                <input name="name" placeholder="Category name" required maxLength={60} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2" />
                <input name="slug" placeholder="category-slug" required maxLength={60} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2" />
                <textarea name="description" placeholder="Description" maxLength={240} rows={2} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 md:col-span-2" />
                <input name="sortOrder" type="number" defaultValue={categories.length * 10 + 10} className="rounded-xl border border-white/15 bg-black/30 px-3 py-2" />
                <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" value="true" defaultChecked /> Active</label>
                <select name="topicCreationPolicy" defaultValue="MEMBERS" className="rounded-xl border border-white/15 bg-[#160b20] px-3 py-2"><option value="MEMBERS">Member topics</option><option value="ADMINS">Admin topics</option><option value="DISABLED">Topics disabled</option></select>
                <select name="replyPolicy" defaultValue="MEMBERS" className="rounded-xl border border-white/15 bg-[#160b20] px-3 py-2"><option value="MEMBERS">Member replies</option><option value="ADMINS">Admin replies</option><option value="DISABLED">Replies disabled</option></select>
                <div className="md:col-span-2"><button className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500">Create category</button></div>
              </form>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
