import Link from "next/link";
import { redirect } from "next/navigation";
import type { KennelNotice, KennelNoticeType } from "@prisma/client";

import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import DeleteReadNoticesForm from "@/components/notices/DeleteReadNoticesForm";
import { listKennelNotices } from "@/server/services/kennelNotice.service";

type NoticesSearchParams = {
  message?: string | string[];
  error?: string | string[];
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatNoticeDate(epoch: number): string {
  return epochToDate(epoch).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function formatNoticeType(type: KennelNoticeType): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getNoticeMetadataString(
  notice: KennelNotice,
  key: string
): string | null {
  const metadata = notice.metadataJson;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function getNoticeHref(notice: KennelNotice): string | null {
  const communityTopicPath = getNoticeMetadataString(notice, "topicPath");

  if (
    notice.linkedThreadId &&
    communityTopicPath?.startsWith("/community/")
  ) {
    return communityTopicPath;
  }

  if (notice.linkedThreadId) return `/bulletin/thread/${notice.linkedThreadId}`;
  if (notice.linkedLitterId) return `/litters/${notice.linkedLitterId}`;
  if (notice.type === "INVITATIONAL_INVITE" && notice.linkedShowId) {
    return `/shows/${notice.linkedShowId}`;
  }
  if (notice.linkedDogId) return `/dogs/${notice.linkedDogId}`;
  if (notice.linkedShowId) return `/shows/${notice.linkedShowId}`;
  if (notice.linkedListingId) return "/market";
  return null;
}

export default async function NoticesPage({
  searchParams,
}: {
  searchParams?: Promise<NoticesSearchParams>;
}) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { id: true, name: true },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const notices = await listKennelNotices({ kennelId: kennel.id, take: 100 });
  const unreadCount = notices.filter((notice) => notice.readAtEpoch === null)
    .length;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const message = firstQueryValue(resolvedSearchParams.message);
  const error = firstQueryValue(resolvedSearchParams.error);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-8 shadow-[var(--dog-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--dog-label)]">
              Kennel Inbox
            </p>
            <h1 className="mt-2 text-4xl font-semibold">Notifications</h1>
            <p className="mt-3 text-[var(--dog-copy)]">
              Recent notices for {kennel.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/kennel"
              className="rounded-xl bg-fuchsia-700 px-6 py-3 text-sm font-semibold text-white hover:bg-fuchsia-600"
            >
              My Kennel
            </Link>
            {unreadCount > 0 ? (
              <form action="/api/notices/mark-all-read" method="post">
                <button
                  type="submit"
                  className="theme-secondary-button rounded-xl px-6 py-3 text-sm font-semibold"
                >
                  Mark All Read
                </button>
              </form>
            ) : null}
            <DeleteReadNoticesForm />
          </div>
        </div>
      </section>

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-red-300/35 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5">
        {notices.length === 0 ? (
          <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-8 text-[var(--dog-copy)]">
            No notifications yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {notices.map((notice) => {
              const href = getNoticeHref(notice);
              const isUnread = notice.readAtEpoch === null;

              return (
                <article
                  key={notice.id}
                  className={`rounded-xl border p-5 ${
                    isUnread
                      ? "border-fuchsia-400/50 bg-fuchsia-950/25"
                      : "border-[var(--dog-border)] bg-[var(--dog-card)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
                        <span>{formatNoticeType(notice.type)}</span>
                        {isUnread ? (
                          <span className="rounded-full bg-fuchsia-700 px-2 py-0.5 text-[10px] tracking-normal text-white">
                            Unread
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        {notice.title}
                      </h2>
                      {notice.body ? (
                        <p className="mt-2 text-[var(--dog-copy)]">{notice.body}</p>
                      ) : null}
                      <p className="mt-3 text-sm text-[var(--dog-label)]">
                        {formatNoticeDate(notice.createdAtEpoch)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {href ? (
                        <Link
                          href={href}
                          className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold"
                        >
                          Open
                        </Link>
                      ) : null}
                      {isUnread ? (
                        <form
                          action={`/api/notices/${notice.id}/read`}
                          method="post"
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/40"
                          >
                            Read
                          </button>
                        </form>
                      ) : null}
                      <form
                        action={`/api/notices/${notice.id}/dismiss`}
                        method="post"
                      >
                        <button
                          type="submit"
                          className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold"
                        >
                          Dismiss
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
