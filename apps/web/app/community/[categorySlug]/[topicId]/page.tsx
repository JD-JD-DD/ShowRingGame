import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import CommunityAuthor from "@/components/community/CommunityAuthor";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  getBulletinThread,
  getCommunityActor,
} from "@/server/services/bulletin.service";

const LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:)\]]+$/;

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

function renderLinkedText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const trimmed = raw.replace(TRAILING_PUNCTUATION_PATTERN, "");
    const trailing = raw.slice(trimmed.length);
    const candidate = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;
    let href: string | null = null;
    try {
      const url = new URL(candidate);
      href = url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      href = null;
    }
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    nodes.push(href ? <a key={`${href}-${start}`} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-200 underline underline-offset-4">{trimmed}</a> : trimmed);
    if (trailing) nodes.push(trailing);
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function policyAllows(policy: string, isAdmin: boolean): boolean {
  return policy === "MEMBERS" || (policy === "ADMINS" && isAdmin);
}

export default async function CommunityTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string; topicId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const actor = await getCommunityActor(userId);
  if (!actor.kennel) redirect("/onboarding");

  const { categorySlug, topicId } = await params;
  const { error } = await searchParams;
  const topic = await getBulletinThread(topicId, { includeModerated: actor.isAdmin });
  if (!topic) notFound();
  if (topic.category.slug !== categorySlug) redirect(`/community/${topic.category.slug}/${topic.id}`);

  const hasPostingKennel = actor.isAdmin || actor.kennel.ownedDogCount > 0;
  const topicAllowsReplies = topic.status === "OPEN" || (topic.status === "LOCKED" && actor.isAdmin);
  const canReply =
    hasPostingKennel &&
    topicAllowsReplies &&
    policyAllows(topic.category.replyPolicy, actor.isAdmin);

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-purple-100/60">
                <Link href="/community" className="font-semibold hover:underline">Community</Link><span>·</span>
                <Link href={`/community/${topic.category.slug}`} className="font-semibold hover:underline">{topic.category.name}</Link>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold">{topic.title}</h1>
                {topic.pinned ? <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase text-amber-100">Pinned</span> : null}
                {topic.status !== "OPEN" ? <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold uppercase text-fuchsia-100">{topic.status}</span> : null}
              </div>
              <div className="mt-4"><CommunityAuthor kennel={topic.kennel} badges={topic.badges} /></div>
            </div>
            <Link href={`/community/${topic.category.slug}`} className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 hover:bg-white/10">Back to category</Link>
          </div>
        </header>

        {error ? <p className="mb-6 rounded-2xl border border-red-300/25 bg-red-950/35 px-4 py-3 text-sm text-red-100">{error}</p> : null}

        {actor.isAdmin ? (
          <section className="mb-6 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-950/20 p-4">
            <h2 className="font-semibold">Topic moderation</h2>
            <form action={`/api/community/admin/topics/${topic.id}`} method="post" className="mt-3 flex flex-wrap items-end gap-2">
              <input name="reason" maxLength={240} placeholder="Optional moderation reason" className="min-w-[240px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm" />
              <button name="action" value={topic.pinned ? "UNPIN" : "PIN"} className="rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold">{topic.pinned ? "Unpin" : "Pin"}</button>
              <button name="action" value={topic.status === "LOCKED" ? "UNLOCK" : "LOCK"} className="rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold">{topic.status === "LOCKED" ? "Unlock" : "Lock"}</button>
              <button name="action" value={topic.status === "HIDDEN" || topic.status === "DELETED" ? "RESTORE" : "HIDE"} className="rounded-xl border border-amber-300/25 px-3 py-2 text-sm font-semibold text-amber-100">{topic.status === "HIDDEN" || topic.status === "DELETED" ? "Restore" : "Hide"}</button>
              <button name="action" value="DELETE" className="rounded-xl border border-red-300/25 px-3 py-2 text-sm font-semibold text-red-100">Delete</button>
            </form>
          </section>
        ) : null}

        <section className="grid gap-4">
          {topic.posts.map((post, index) => (
            <article key={post.id} className={`rounded-[24px] border p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)] ${post.moderationStatus === "VISIBLE" ? "border-white/10 bg-white/5" : "border-amber-300/25 bg-amber-950/15"}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <CommunityAuthor kennel={post.kennel} badges={post.badges} />
                <div className="text-xs text-purple-100/60">{index === 0 ? "Original post" : `Reply ${index}`} · {formatEpoch(post.createdAtEpoch)}</div>
              </div>
              {post.moderationStatus !== "VISIBLE" ? <p className="mb-3 text-xs font-semibold uppercase text-amber-200">{post.moderationStatus}{post.moderationReason ? ` · ${post.moderationReason}` : ""}</p> : null}
              <div className="whitespace-pre-wrap text-sm leading-7 text-purple-100/80">{renderLinkedText(post.body)}</div>
              {actor.isAdmin && index > 0 ? (
                <form action={`/api/community/admin/posts/${post.id}`} method="post" className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <input name="reason" maxLength={240} placeholder="Optional reason" className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm" />
                  <button name="action" value={post.moderationStatus === "VISIBLE" ? "HIDE" : "RESTORE"} className="rounded-xl border border-amber-300/25 px-3 py-2 text-sm font-semibold text-amber-100">{post.moderationStatus === "VISIBLE" ? "Hide post" : "Restore post"}</button>
                  <button name="action" value="DELETE" className="rounded-xl border border-red-300/25 px-3 py-2 text-sm font-semibold text-red-100">Delete post</button>
                </form>
              ) : null}
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[24px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5">
          <h2 className="text-xl font-semibold">Reply</h2>
          {canReply ? (
            <form action={`/api/bulletin/threads/${topic.id}/posts`} method="post" className="mt-5 grid gap-4">
              <input type="hidden" name="categorySlug" value={topic.category.slug} />
              <textarea name="body" required maxLength={5000} rows={5} placeholder="Write a reply..." className="rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-3 leading-7 text-white outline-none" />
              <div><button className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold hover:bg-purple-500">Post reply</button></div>
            </form>
          ) : (
            <p className="mt-3 text-sm leading-7 text-purple-100/70">
              {topic.status === "LOCKED" ? "This topic is locked." : topic.status === "HIDDEN" || topic.status === "DELETED" ? "Moderated topics cannot receive replies." : topic.category.replyPolicy === "ADMINS" ? "Only administrators can reply in this category." : topic.category.replyPolicy === "DISABLED" ? "Replies are disabled in this category." : "Own at least one dog before replying."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
