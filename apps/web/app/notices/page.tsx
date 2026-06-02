import Link from "next/link";
import { redirect } from "next/navigation";
import type { KennelNotice, KennelNoticeType } from "@prisma/client";

import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { listKennelNotices } from "@/server/services/kennelNotice.service";

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

function getNoticeHref(notice: KennelNotice): string | null {
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

export default async function NoticesPage() {
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl border border-purple-300/20 bg-purple-950/40 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-200">
              Kennel Inbox
            </p>
            <h1 className="mt-2 text-4xl font-semibold">Notifications</h1>
            <p className="mt-3 text-purple-100/75">
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
                  className="rounded-xl border border-purple-300/30 px-6 py-3 text-sm font-semibold text-purple-100 hover:bg-purple-950/50"
                >
                  Mark All Read
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-purple-300/20 bg-black/25 p-5">
        {notices.length === 0 ? (
          <div className="rounded-xl border border-purple-300/20 bg-purple-950/30 p-8 text-purple-100/75">
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
                      : "border-purple-300/15 bg-purple-950/25"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200/75">
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
                        <p className="mt-2 text-purple-100/75">{notice.body}</p>
                      ) : null}
                      <p className="mt-3 text-sm text-purple-200/60">
                        {formatNoticeDate(notice.createdAtEpoch)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {href ? (
                        <Link
                          href={href}
                          className="rounded-lg border border-purple-300/30 px-4 py-2 text-sm font-semibold text-purple-100 hover:bg-purple-950/50"
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
                          className="rounded-lg border border-purple-300/20 px-4 py-2 text-sm font-semibold text-purple-200/80 hover:bg-purple-950/50"
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
