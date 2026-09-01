import { KennelNoticeType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type DbClient = typeof db | Prisma.TransactionClient;
const INVITATIONAL_RESULTS_NOTICE_BATCH_SIZE = 500;
export const SYSTEM_BROADCAST_BATCH_SIZE = 500;
const SYSTEM_BROADCAST_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SYSTEM_BROADCAST_KEY_LENGTH = 80;
const MAX_SYSTEM_BROADCAST_TITLE_LENGTH = 160;
const MAX_SYSTEM_BROADCAST_BODY_LENGTH = 2000;
const MAX_SYSTEM_BROADCAST_ACTION_LABEL_LENGTH = 80;

export class SystemBroadcastError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type SystemBroadcastAction = { label: string; href: string };
export type SystemBroadcastInput = { broadcastKey: string; title: string; body: string; actions: SystemBroadcastAction[] };
export type SystemBroadcastPreview = SystemBroadcastInput & { eligibleRecipients: number; alreadyHasBroadcast: number; wouldCreate: number };
export type SystemBroadcastSummary = { broadcastKey: string; eligibleRecipients: number; created: number; skippedExisting: number; batches: number };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function requiredText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") throw new SystemBroadcastError(`${label} is required.`);
  const normalized = value.trim();
  if (!normalized) throw new SystemBroadcastError(`${label} is required.`);
  if (normalized.length > maximumLength) throw new SystemBroadcastError(`${label} is too long.`);
  return normalized;
}

export function isSafeSystemBroadcastHref(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const href = value.trim();
  let decodedHref: string;
  try { decodedHref = decodeURIComponent(href); } catch { return false; }
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\") || decodedHref.startsWith("//") || decodedHref.includes("\\")) return false;
  try {
    return new URL(href, "https://showring.local").origin === "https://showring.local";
  } catch {
    return false;
  }
}

function normalizeSystemBroadcastActions(value: unknown): SystemBroadcastAction[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 2) throw new SystemBroadcastError("Provide up to two internal actions.");
  return value.map((item) => {
    const action = record(item);
    const label = requiredText(action?.label, "Action label", MAX_SYSTEM_BROADCAST_ACTION_LABEL_LENGTH);
    const href = typeof action?.href === "string" ? action.href.trim() : "";
    if (!isSafeSystemBroadcastHref(href)) throw new SystemBroadcastError("Action links must be safe internal paths.");
    return { label, href };
  });
}

export function parseSystemBroadcastInput(value: unknown): SystemBroadcastInput {
  const input = record(value);
  const broadcastKey = requiredText(input?.broadcastKey, "Broadcast key", MAX_SYSTEM_BROADCAST_KEY_LENGTH);
  if (!SYSTEM_BROADCAST_KEY_PATTERN.test(broadcastKey)) throw new SystemBroadcastError("Broadcast key must use lowercase letters, numbers, and single hyphens.");
  return {
    broadcastKey,
    title: requiredText(input?.title, "Title", MAX_SYSTEM_BROADCAST_TITLE_LENGTH),
    body: requiredText(input?.body, "Body", MAX_SYSTEM_BROADCAST_BODY_LENGTH),
    actions: normalizeSystemBroadcastActions(input?.actions),
  };
}

export function getSystemBroadcastNoticeActions(notice: { type: KennelNoticeType; metadataJson: unknown }): SystemBroadcastAction[] {
  if (notice.type !== "KENNEL_SERVICE") return [];
  const metadata = record(notice.metadataJson);
  const systemBroadcast = record(metadata?.systemBroadcast);
  const actions = systemBroadcast?.actions;
  if (!Array.isArray(actions)) return [];
  return actions.slice(0, 2).flatMap((item) => {
    const action = record(item);
    const label = typeof action?.label === "string" && action.label.trim().length <= MAX_SYSTEM_BROADCAST_ACTION_LABEL_LENGTH ? action.label.trim() : "";
    const href = typeof action?.href === "string" ? action.href.trim() : "";
    return label && isSafeSystemBroadcastHref(href) ? [{ label, href }] : [];
  });
}

function getSystemBroadcastSourceKey(broadcastKey: string, kennelId: string) {
  return `system-broadcast:${broadcastKey}:${kennelId}`;
}

async function listSystemBroadcastRecipientKennels(client: any) {
  return client.kennel.findMany({
    where: {
      isNpc: false,
      userId: { not: null },
      moderationStatus: "ACTIVE",
      user: { is: { moderationStatus: "ACTIVE" } },
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });
}

async function countExistingSystemBroadcasts(client: any, sourceKeys: string[]) {
  if (!sourceKeys.length) return 0;
  let count = 0;
  for (let index = 0; index < sourceKeys.length; index += SYSTEM_BROADCAST_BATCH_SIZE) {
    count += await client.kennelNotice.count({ where: { sourceKey: { in: sourceKeys.slice(index, index + SYSTEM_BROADCAST_BATCH_SIZE) } } });
  }
  return count;
}

export async function previewSystemKennelBroadcast(args: { input: unknown; client?: any }): Promise<SystemBroadcastPreview> {
  const input = parseSystemBroadcastInput(args.input);
  const client = args.client ?? db;
  const recipients = await listSystemBroadcastRecipientKennels(client);
  const alreadyHasBroadcast = await countExistingSystemBroadcasts(client, recipients.map((kennel: { id: string }) => getSystemBroadcastSourceKey(input.broadcastKey, kennel.id)));
  return { ...input, eligibleRecipients: recipients.length, alreadyHasBroadcast, wouldCreate: recipients.length - alreadyHasBroadcast };
}

export async function createSystemKennelBroadcast(args: { input: unknown; currentEpoch: number; client?: any }): Promise<SystemBroadcastSummary> {
  const input = parseSystemBroadcastInput(args.input);
  const client = args.client ?? db;
  const recipients = await listSystemBroadcastRecipientKennels(client);
  const rows: Prisma.KennelNoticeCreateManyInput[] = recipients.map((kennel: { id: string }) => ({
    kennelId: kennel.id,
    sourceKey: getSystemBroadcastSourceKey(input.broadcastKey, kennel.id),
    type: "KENNEL_SERVICE",
    title: input.title,
    body: input.body,
    createdAtEpoch: args.currentEpoch,
    metadataJson: { systemBroadcast: { key: input.broadcastKey, actions: input.actions } },
  }));
  let created = 0;
  let batches = 0;
  for (let index = 0; index < rows.length; index += SYSTEM_BROADCAST_BATCH_SIZE) {
    const result = await client.kennelNotice.createMany({ data: rows.slice(index, index + SYSTEM_BROADCAST_BATCH_SIZE), skipDuplicates: true });
    created += result.count;
    batches += 1;
  }
  const summary = { broadcastKey: input.broadcastKey, eligibleRecipients: recipients.length, created, skippedExisting: recipients.length - created, batches };
  console.info("system-kennel-broadcast", summary);
  return summary;
}

export type KennelNoticeLinkArgs = {
  linkedDogId?: string | null;
  linkedLitterId?: string | null;
  linkedShowId?: string | null;
  linkedThreadId?: string | null;
  linkedListingId?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export async function createKennelNotice(args: {
  client?: DbClient;
  kennelId: string | null | undefined;
  sourceKey?: string | null;
  type: KennelNoticeType;
  title: string;
  body?: string | null;
  currentEpoch: number;
} & KennelNoticeLinkArgs) {
  if (!args.kennelId) {
    return null;
  }

  const client = args.client ?? db;

  if (args.sourceKey) {
    const existingNotice = await client.kennelNotice.findUnique({
      where: {
        sourceKey: args.sourceKey,
      },
    });

    if (existingNotice) {
      return existingNotice;
    }
  }

  try {
    return await client.kennelNotice.create({
      data: {
        kennelId: args.kennelId,
        sourceKey: args.sourceKey ?? null,
        type: args.type,
        title: args.title,
        body: args.body ?? null,
        createdAtEpoch: args.currentEpoch,
        linkedDogId: args.linkedDogId ?? null,
        linkedLitterId: args.linkedLitterId ?? null,
        linkedShowId: args.linkedShowId ?? null,
        linkedThreadId: args.linkedThreadId ?? null,
        linkedListingId: args.linkedListingId ?? null,
        metadataJson: args.metadataJson ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    if (
      args.sourceKey &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return client.kennelNotice.findUnique({
        where: {
          sourceKey: args.sourceKey,
        },
      });
    }

    console.error("Unable to create kennel notice:", error);
    return null;
  }
}

export function getReproductiveEmergencyNoticeSourceKey(
  breedingAttemptId: string
): string {
  return `REPRODUCTIVE_EMERGENCY_NOTICE:${breedingAttemptId}`;
}

export async function createReproductiveEmergencyNotice(args: {
  client: DbClient;
  kennelId: string | null | undefined;
  breedingAttemptId: string;
  damId: string;
  currentEpoch: number;
}) {
  return createKennelNotice({
    client: args.client,
    kennelId: args.kennelId,
    sourceKey: getReproductiveEmergencyNoticeSourceKey(args.breedingAttemptId),
    type: "KENNEL_SERVICE",
    title: "Emergency veterinary care required",
    body: "Your dam has a serious whelping complication. Litter resolution is paused while emergency veterinary care is required.",
    currentEpoch: args.currentEpoch,
    linkedDogId: args.damId,
    metadataJson: {
      noticeKind: "REPRODUCTIVE_EMERGENCY",
      breedingAttemptId: args.breedingAttemptId,
    },
  });
}

export async function getUnreadKennelNoticeCount(kennelId: string) {
  return db.kennelNotice.count({
    where: {
      kennelId,
      readAtEpoch: null,
      dismissedAtEpoch: null,
    },
  });
}

export async function listKennelNotices(args: {
  kennelId: string;
  take?: number;
}) {
  return db.kennelNotice.findMany({
    where: {
      kennelId: args.kennelId,
      dismissedAtEpoch: null,
    },
    orderBy: [{ createdAtEpoch: "desc" }, { createdAt: "desc" }],
    take: args.take ?? 50,
  });
}

export async function markKennelNoticeRead(args: {
  kennelId: string;
  noticeId: string;
  currentEpoch: number;
}) {
  await db.kennelNotice.updateMany({
    where: {
      id: args.noticeId,
      kennelId: args.kennelId,
      readAtEpoch: null,
    },
    data: {
      readAtEpoch: args.currentEpoch,
    },
  });
}

export async function dismissKennelNotice(args: {
  kennelId: string;
  noticeId: string;
  currentEpoch: number;
}) {
  await db.kennelNotice.updateMany({
    where: {
      id: args.noticeId,
      kennelId: args.kennelId,
    },
    data: {
      dismissedAtEpoch: args.currentEpoch,
      readAtEpoch: args.currentEpoch,
    },
  });
}

export async function markAllKennelNoticesRead(args: {
  kennelId: string;
  currentEpoch: number;
}) {
  await db.kennelNotice.updateMany({
    where: {
      kennelId: args.kennelId,
      readAtEpoch: null,
      dismissedAtEpoch: null,
    },
    data: {
      readAtEpoch: args.currentEpoch,
    },
  });
}

export async function deleteReadKennelInboxNotices(args: {
  client?: DbClient;
  kennelId: string;
  currentEpoch: number;
}) {
  const client = args.client ?? db;

  const result = await client.kennelNotice.updateMany({
    where: {
      kennelId: args.kennelId,
      readAtEpoch: {
        not: null,
      },
      dismissedAtEpoch: null,
    },
    data: {
      dismissedAtEpoch: args.currentEpoch,
    },
  });

  return {
    deletedCount: result.count,
  };
}

export function getDogTitleNoticeSourceKey(args: {
  dogId: string;
  titleCode: string;
  kennelId: string;
}) {
  return `dog-title:${args.dogId}:${args.titleCode}:${args.kennelId}`;
}

export async function createDogTitleNotice(args: {
  client?: DbClient;
  kennelId: string | null | undefined;
  dogId: string;
  dogDisplayName: string;
  noticeType: KennelNoticeType;
  titleCode: string;
  titleLabel?: string | null;
  sourceKey: string;
  title: string;
  body: string;
  currentEpoch: number;
  metadataJson?: Prisma.InputJsonValue | null;
}) {
  if (!args.kennelId) {
    return null;
  }

  const client = args.client ?? db;
  const eligibleOwnerKennel = await client.kennel.findFirst({
    where: {
      id: args.kennelId,
      isNpc: false,
      userId: { not: null },
      moderationStatus: "ACTIVE",
      user: {
        is: {
          moderationStatus: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!eligibleOwnerKennel) {
    return null;
  }

  return createKennelNotice({
    client,
    kennelId: eligibleOwnerKennel.id,
    sourceKey: args.sourceKey,
    type: args.noticeType,
    title: args.title,
    body: args.body,
    currentEpoch: args.currentEpoch,
    linkedDogId: args.dogId,
    metadataJson: args.metadataJson,
  });
}

function getInvitationalResultsNoticeSourceKey(args: {
  clusterId: string;
  kennelId: string;
}) {
  return `invitational-results:${args.clusterId}:${args.kennelId}`;
}

export async function createInvitationalResultsPublishedNotices(args: {
  client?: DbClient;
  clusterId: string;
  clusterName: string;
  invitationalYear: number;
  currentEpoch: number;
}) {
  const client = args.client ?? db;
  const recipientKennels = await client.kennel.findMany({
    where: {
      isNpc: false,
      userId: { not: null },
      moderationStatus: "ACTIVE",
      user: {
        is: {
          moderationStatus: "ACTIVE",
        },
      },
    },
    orderBy: {
      id: "asc",
    },
    select: {
      id: true,
    },
  });

  if (recipientKennels.length === 0) {
    return {
      recipientCount: 0,
      createdCount: 0,
      batchCount: 0,
    };
  }

  const title = "Invitational Results Are Available";
  const body = `The Year ${args.invitationalYear} Invitational has finished judging. View the complete results.`;
  const resultsPath = `/shows/${args.clusterId}/results`;
  const noticeRows: Prisma.KennelNoticeCreateManyInput[] = recipientKennels.map(
    (kennel) => ({
      kennelId: kennel.id,
      sourceKey: getInvitationalResultsNoticeSourceKey({
        clusterId: args.clusterId,
        kennelId: kennel.id,
      }),
      type: "INVITATIONAL_RESULTS_PUBLISHED",
      title,
      body,
      createdAtEpoch: args.currentEpoch,
      linkedShowId: args.clusterId,
      metadataJson: {
        gameYear: args.invitationalYear,
        resultsPath,
        clusterName: args.clusterName,
      },
    })
  );

  let createdCount = 0;
  let batchCount = 0;

  for (
    let index = 0;
    index < noticeRows.length;
    index += INVITATIONAL_RESULTS_NOTICE_BATCH_SIZE
  ) {
    const batch = noticeRows.slice(
      index,
      index + INVITATIONAL_RESULTS_NOTICE_BATCH_SIZE
    );
    const result = await client.kennelNotice.createMany({
      data: batch,
      skipDuplicates: true,
    });

    createdCount += result.count;
    batchCount += 1;
  }

  return {
    recipientCount: recipientKennels.length,
    createdCount,
    batchCount,
  };
}

export async function createDogProgenyTitleEarnedNotice(args: {
  client?: DbClient;
  kennelId: string | null | undefined;
  dogId: string;
  dogDisplayName: string;
  titleCode: string;
  titleLabel: string;
  currentEpoch: number;
}) {
  if (!args.kennelId) {
    return null;
  }

  return createDogTitleNotice({
    client: args.client,
    kennelId: args.kennelId,
    dogId: args.dogId,
    dogDisplayName: args.dogDisplayName,
    noticeType: "DOG_PROGENY_TITLE_EARNED" as KennelNoticeType,
    titleCode: args.titleCode,
    titleLabel: args.titleLabel,
    sourceKey: getDogTitleNoticeSourceKey({
      dogId: args.dogId,
      titleCode: args.titleCode,
      kennelId: args.kennelId,
    }),
    title: `New ${args.titleCode} title`,
    body: `${args.dogDisplayName} has earned the ${args.titleLabel} title.`,
    currentEpoch: args.currentEpoch,
    metadataJson: {
      titleCode: args.titleCode,
      titleLabel: args.titleLabel,
    },
  });
}
