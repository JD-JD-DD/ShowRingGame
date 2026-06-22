import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import CommunityAuthor from "@/components/community/CommunityAuthor";
import { getSessionUserId } from "@/lib/session";
import {
  getBulletinThread,
  getCommunityActor,
} from "@/server/services/bulletin.service";

const LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:)\]]+$/;

function formatPostTime(createdAt: Date): string {
  return createdAt.toLocaleString("en-US", {
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
  const actorKennel = actor.kennel;
  if (!actorKennel) redirect("/onboarding");

  const { categorySlug, topicId } = await params;
  const { error } = await searchParams;
  const topic = await getBulletinThread(topicId, { includeModerated: actor.isAdmin });
  if (!topic) notFound();
  if (topic.category.slug !== categorySlug) redirect(`/community/${topic.category.slug}/${topic.id}`);

  const hasPostingKennel = actor.isAdmin || actorKennel.ownedDogCount > 0;
  const topicAllowsReplies = topic.status === "OPEN" || (topic.status === "LOCKED" && actor.isAdmin);
  const canReply =
    hasPostingKennel &&
    topicAllowsReplies &&
    policyAllows(topic.category.replyPolicy, actor.isAdmin);
  const isTopicOwner =
    topic.sourceType === "PLAYER" && topic.kennel.id === actorKennel.id;
  const originalPost = topic.posts[0];
  const canEditOwnTopic =
    isTopicOwner &&
    topic.status === "OPEN" &&
    originalPost?.sourceType === "PLAYER" &&
    originalPost.moderationStatus === "VISIBLE";

  return (
    <main className="community-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="theme-label flex flex-wrap items-center gap-2 text-xs">
                <Link href="/community" className="font-semibold hover:underline">Community</Link><span>·</span>
                <Link href={`/community/${topic.category.slug}`} className="font-semibold hover:underline">{topic.category.name}</Link>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="theme-heading text-3xl font-semibold">{topic.title}</h1>
                {topic.pinned ? <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase text-amber-100">Pinned</span> : null}
                {topic.status !== "OPEN" ? <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold uppercase text-fuchsia-100">{topic.status}</span> : null}
              </div>
              <div className="mt-4"><CommunityAuthor kennel={topic.kennel} badges={topic.badges} /></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#reply-composer" className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500">
                Jump to Reply
              </a>
              <Link href="/community" className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold">
                Main Forum
              </Link>
              <Link href="/kennel" className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold">
                My Kennel
              </Link>
            </div>
          </div>
        </header>

        {error ? <p className="mb-6 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}

        {actor.isAdmin ? (
          <section className="theme-card mb-6 rounded-2xl p-4">
            <h2 className="theme-heading font-semibold">Topic moderation</h2>
            <form action={`/api/community/admin/topics/${topic.id}`} method="post" className="mt-3 flex flex-wrap items-end gap-2">
              <input name="reason" maxLength={240} placeholder="Optional moderation reason" className="theme-control min-w-[240px] flex-1 rounded-xl px-3 py-2 text-sm" />
              <button name="action" value={topic.pinned ? "UNPIN" : "PIN"} className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold">{topic.pinned ? "Unpin" : "Pin"}</button>
              <button name="action" value={topic.status === "LOCKED" ? "UNLOCK" : "LOCK"} className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold">{topic.status === "LOCKED" ? "Unlock" : "Lock"}</button>
              <button name="action" value={topic.status === "HIDDEN" || topic.status === "DELETED" ? "RESTORE" : "HIDE"} className="rounded-xl border border-amber-300/25 px-3 py-2 text-sm font-semibold text-amber-100">{topic.status === "HIDDEN" || topic.status === "DELETED" ? "Restore" : "Hide"}</button>
              <button name="action" value="DELETE" className="rounded-xl border border-red-300/25 px-3 py-2 text-sm font-semibold text-red-100">Delete</button>
            </form>
          </section>
        ) : null}

        {isTopicOwner ? (
          <details className="theme-card mb-6 rounded-2xl p-4">
            <summary className="theme-heading cursor-pointer text-sm font-semibold">
              Edit or delete your topic
            </summary>
            {canEditOwnTopic ? (
              <form action={`/api/community/topics/${topic.id}`} method="post" className="mt-4 grid gap-3">
                <input type="hidden" name="action" value="EDIT" />
                <label className="theme-label grid gap-1 text-xs font-semibold uppercase tracking-wide">
                  Topic title
                  <input name="title" defaultValue={topic.title} required maxLength={90} className="theme-control rounded-xl px-3 py-2 text-sm normal-case tracking-normal" />
                </label>
                <label className="theme-label grid gap-1 text-xs font-semibold uppercase tracking-wide">
                  Original post
                  <textarea name="body" defaultValue={originalPost?.body ?? ""} required maxLength={5000} rows={6} className="theme-control rounded-xl px-3 py-2 text-sm font-normal normal-case leading-6 tracking-normal" />
                </label>
                <div>
                  <button className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">
                    Save topic changes
                  </button>
                </div>
              </form>
            ) : (
              <p className="theme-copy mt-3 text-sm">
                This topic can no longer be edited, but you may still delete it.
              </p>
            )}
            <form action={`/api/community/topics/${topic.id}`} method="post" className="mt-4 border-t border-[color:var(--dog-border)] pt-4">
              <button name="action" value="DELETE" className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20">
                Delete topic
              </button>
            </form>
          </details>
        ) : null}

        <section className="grid gap-4">
          {topic.posts.map((post, index) => (
            <article key={post.id} className={`rounded-[24px] p-5 ${post.moderationStatus === "VISIBLE" ? "theme-card" : "border border-amber-300/25 bg-amber-500/10"}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <CommunityAuthor kennel={post.kennel} badges={post.badges} />
                <div className="theme-label text-xs">{index === 0 ? "Original post" : `Reply ${index}`} · {formatPostTime(post.createdAt)}</div>
              </div>
              {post.moderationStatus !== "VISIBLE" ? <p className="mb-3 text-xs font-semibold uppercase text-amber-200">{post.moderationStatus}{post.moderationReason ? ` · ${post.moderationReason}` : ""}</p> : null}
              <div className="theme-copy whitespace-pre-wrap text-sm leading-7">{renderLinkedText(post.body)}</div>
              {actor.isAdmin && index > 0 ? (
                <form action={`/api/community/admin/posts/${post.id}`} method="post" className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--dog-border)] pt-4">
                  <input name="reason" maxLength={240} placeholder="Optional reason" className="theme-control min-w-[200px] flex-1 rounded-xl px-3 py-2 text-sm" />
                  <button name="action" value={post.moderationStatus === "VISIBLE" ? "HIDE" : "RESTORE"} className="rounded-xl border border-amber-300/25 px-3 py-2 text-sm font-semibold text-amber-100">{post.moderationStatus === "VISIBLE" ? "Hide post" : "Restore post"}</button>
                  <button name="action" value="DELETE" className="rounded-xl border border-red-300/25 px-3 py-2 text-sm font-semibold text-red-100">Delete post</button>
                </form>
              ) : null}
              {index > 0 && post.sourceType === "PLAYER" && post.kennel.id === actorKennel.id ? (
                <details className="mt-4 border-t border-[color:var(--dog-border)] pt-4">
                  <summary className="theme-heading cursor-pointer text-sm font-semibold">
                    Edit or delete your reply
                  </summary>
                  {topic.status === "OPEN" && post.moderationStatus === "VISIBLE" ? (
                    <form action={`/api/community/posts/${post.id}`} method="post" className="mt-3 grid gap-3">
                      <input type="hidden" name="action" value="EDIT" />
                      <textarea name="body" defaultValue={post.body} required maxLength={5000} rows={5} className="theme-control rounded-xl px-3 py-2 text-sm leading-6" />
                      <div>
                        <button className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">
                          Save reply changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="theme-copy mt-3 text-sm">
                      This reply can no longer be edited.
                    </p>
                  )}
                  <form action={`/api/community/posts/${post.id}`} method="post" className="mt-3">
                    <button name="action" value="DELETE" className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20">
                      Delete reply
                    </button>
                  </form>
                </details>
              ) : null}
            </article>
          ))}
        </section>

        <section id="reply-composer" className="theme-panel mt-8 scroll-mt-6 rounded-[24px] p-5">
          <h2 className="theme-heading text-xl font-semibold">Reply</h2>
          {canReply ? (
            <form action={`/api/bulletin/threads/${topic.id}/posts`} method="post" className="mt-5 grid gap-4">
              <input type="hidden" name="categorySlug" value={topic.category.slug} />
              <textarea name="body" required maxLength={5000} rows={5} placeholder="Write a reply..." className="theme-control rounded-2xl px-4 py-3 leading-7 outline-none" />
              <div><button className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-500">Post reply</button></div>
            </form>
          ) : (
            <p className="theme-copy mt-3 text-sm leading-7">
              {topic.status === "LOCKED" ? "This topic is locked." : topic.status === "HIDDEN" || topic.status === "DELETED" ? "Moderated topics cannot receive replies." : topic.category.replyPolicy === "ADMINS" ? "Only administrators can reply in this category." : topic.category.replyPolicy === "DISABLED" ? "Replies are disabled in this category." : "Own at least one dog before replying."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
