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

  for (const [metadataKey, value] of Object.entries(metadata)) {
    if (metadataKey === key && typeof value === "string") return value;
  }

  return null;
}

function isPuppySelectionActionNotice(sourceKey: string): boolean {
  return (
    (sourceKey.includes("STUD_PUPPY_SELECTION_OPEN") && !sourceKey.includes("SECOND_PICK_INFO")) ||
    (sourceKey.includes("STUD_PUPPY_SELECTION_REOPENED") && !sourceKey.includes("DAM_INFO")) ||
    sourceKey.includes("STUD_PUPPY_SELECTION_DAM_PICK") ||
    sourceKey.includes("STUD_PUPPY_SELECTION_DAM_FORFEITED_STUD_OPEN")
  );
}

function getNoticeHref(notice: KennelNotice): string | null {
  const explicitHref = getNoticeMetadataString(notice, "href");
  const communityTopicPath = getNoticeMetadataString(notice, "topicPath");
  const studContractId = getNoticeMetadataString(notice, "studContractId");
  const sourceKey = notice.sourceKey ?? "";
  const isStudContractNotice = sourceKey.startsWith("STUD_");
  const isPuppySelectionAction = isPuppySelectionActionNotice(sourceKey);

  if (explicitHref?.startsWith("/admin/moderation/messages/")) return explicitHref;

  if (notice.sourceKey?.startsWith("STUD_MANUAL_REQUEST_OWNER")) return "/stud-contracts?action=manual-approval";
  if (notice.sourceKey?.startsWith("STUD_RETURN_SERVICE_AVAILABLE")) return "/stud-contracts?action=return-service";
  if (isPuppySelectionAction && notice.linkedLitterId) return `/litters#stud-contract-selection-${notice.linkedLitterId}`;
  if (notice.sourceKey?.startsWith("STUD_PUPPY_TRANSFER") && notice.linkedDogId) return `/dogs/${notice.linkedDogId}`;
  if (isStudContractNotice && studContractId) return `/stud-contracts/${studContractId}`;

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
  if (
    notice.type === "INVITATIONAL_RESULTS_PUBLISHED" &&
    notice.linkedShowId
  ) {
    return `/shows/${notice.linkedShowId}/results`;
  }
  if (notice.linkedDogId) return `/dogs/${notice.linkedDogId}`;
  if (notice.linkedShowId) return `/shows/${notice.linkedShowId}`;
  if (notice.linkedListingId) return "/market";
  return null;
}

function getNoticeLinkLabel(notice: KennelNotice): string {
  const sourceKey = notice.sourceKey ?? "";

  if (sourceKey.startsWith("STUD_MANUAL_REQUEST_OWNER")) return "Review Request";
  if (sourceKey.startsWith("STUD_RETURN_SERVICE_AVAILABLE")) return "View Return Service";
  if (isPuppySelectionActionNotice(sourceKey)) {
    return "Pick Puppy";
  }
  if (sourceKey.startsWith("STUD_")) return "Open Contract";

  return "Open";
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
      <section className="theme-panel rounded-2xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.25em]">
              Kennel Inbox
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-semibold">Notifications</h1>
            <p className="theme-copy mt-3">
              Recent notices for {kennel.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
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
        <div className="theme-status-success mt-5 rounded-2xl px-5 py-4 text-sm font-semibold">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="theme-status-danger mt-5 rounded-2xl px-5 py-4 text-sm font-semibold">
          {error}
        </div>
      ) : null}

      <section className="theme-panel mt-8 rounded-2xl p-5">
        {notices.length === 0 ? (
          <div className="theme-card theme-copy rounded-xl p-8">
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
                      ? "theme-status-info"
                      : "theme-card"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="theme-label flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                        <span>{formatNoticeType(notice.type)}</span>
                        {isUnread ? (
                          <span className="theme-primary-button rounded-full px-2 py-0.5 text-[10px] tracking-normal">
                            Unread
                          </span>
                        ) : null}
                      </div>
                      <h2 className="theme-heading mt-2 text-xl font-semibold">
                        {notice.title}
                      </h2>
                      {notice.body ? (
                        <p className="theme-copy mt-2">{notice.body}</p>
                      ) : null}
                      <p className="theme-label mt-3 text-sm">
                        {formatNoticeDate(notice.createdAtEpoch)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {href ? (
                        <Link
                          href={href}
                          className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold"
                        >
                          {getNoticeLinkLabel(notice)}
                        </Link>
                      ) : null}
                      {isUnread ? (
                        <form
                          action={`/api/notices/${notice.id}/read`}
                          method="post"
                        >
                          <button
                            type="submit"
                            className="theme-status-success rounded-lg px-4 py-2 text-sm font-semibold"
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
