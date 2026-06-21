import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { getKennelPrestigeSummary } from "@/server/services/kennelPrestige.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const VISIBLE_THREAD_WHERE: Prisma.BulletinThreadWhereInput = {
  status: { in: ["OPEN", "LOCKED"] },
};

export type CommunityActor = {
  userId: string;
  isAdmin: boolean;
  kennel: {
    id: string;
    name: string;
    slug: string;
    displayName: string | null;
    ownedDogCount: number;
  } | null;
};

type ThreadListRecord = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  pinned: boolean;
  createdAtEpoch: number;
  lastActivityEpoch: number;
  category: {
    slug: string;
    name: string;
    topicCreationPolicy: string;
    replyPolicy: string;
  };
  kennel: {
    id: string;
    name: string;
    slug: string;
    user: {
      displayName: string | null;
    } | null;
  };
  posts: Array<{
    id: string;
    body: string;
    createdAtEpoch: number;
  }>;
  _count: {
    posts: number;
  };
};

export type KennelPrestigeBadges = {
  prestigeScore: number;
  prestigeRank: string;
};

export type BulletinThreadListItem = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  pinned: boolean;
  createdAtEpoch: number;
  lastActivityEpoch: number;
  replyCount: number;
  preview: string;
  category: {
    slug: string;
    name: string;
    topicCreationPolicy: string;
    replyPolicy: string;
  };
  kennel: {
    id: string;
    name: string;
    slug: string;
    displayName: string | null;
  };
  badges: KennelPrestigeBadges;
};

export type BulletinCategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  topicCreationPolicy: string;
  replyPolicy: string;
  threadCount: number;
  latestThread: BulletinThreadListItem | null;
};

export type BulletinPostDto = {
  id: string;
  body: string;
  sourceType: string;
  moderationStatus: string;
  moderationReason: string | null;
  createdAtEpoch: number;
  kennel: {
    id: string;
    name: string;
    slug: string;
    displayName: string | null;
  };
  badges: KennelPrestigeBadges;
};

export type BulletinThreadDetailDto = BulletinThreadListItem & {
  linkedDogId: string | null;
  linkedShowId: string | null;
  linkedLitterId: string | null;
  linkedResultId: string | null;
  linkedListingId: string | null;
  posts: BulletinPostDto[];
};

function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeBody(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function policyAllows(policy: string, isAdmin: boolean): boolean {
  if (policy === "DISABLED") return false;
  if (policy === "ADMINS") return isAdmin;
  return true;
}

function previewBody(value: string): string {
  const preview = sanitizeText(value, 180);
  return preview.length < value.trim().length ? `${preview}...` : preview;
}

async function badgesForKennels(
  kennelIds: string[]
): Promise<Map<string, KennelPrestigeBadges>> {
  const uniqueKennelIds = [...new Set(kennelIds)].filter(Boolean);
  const result = new Map<string, KennelPrestigeBadges>();

  for (const kennelId of uniqueKennelIds) {
    result.set(kennelId, {
      prestigeScore: 0,
      prestigeRank: "New Kennel",
    });
  }

  await Promise.all(
    uniqueKennelIds.map(async (kennelId) => {
      const prestige = await getKennelPrestigeSummary(kennelId);

      result.set(kennelId, {
        prestigeScore: prestige.score,
        prestigeRank: prestige.tier.label,
      });
    })
  );

  return result;
}

function mapThreadListItem(
  thread: ThreadListRecord,
  badgesByKennelId: Map<string, KennelPrestigeBadges>
): BulletinThreadListItem {
  const firstPost = thread.posts[0];

  return {
    id: thread.id,
    title: thread.title,
    sourceType: thread.sourceType,
    status: thread.status,
    pinned: thread.pinned,
    createdAtEpoch: thread.createdAtEpoch,
    lastActivityEpoch: thread.lastActivityEpoch,
    replyCount: Math.max(0, thread._count.posts - 1),
    preview: firstPost ? previewBody(firstPost.body) : "",
    category: thread.category,
    kennel: {
      id: thread.kennel.id,
      name: thread.kennel.name,
      slug: thread.kennel.slug,
      displayName: thread.kennel.user?.displayName ?? null,
    },
    badges:
      badgesByKennelId.get(thread.kennel.id) ??
      {
        prestigeScore: 0,
        prestigeRank: "New Kennel",
      },
  };
}

async function mapThreadRecords(
  threads: ThreadListRecord[]
): Promise<BulletinThreadListItem[]> {
  const badgesByKennelId = await badgesForKennels(
    threads.map((thread) => thread.kennel.id)
  );

  return threads.map((thread) => mapThreadListItem(thread, badgesByKennelId));
}

export async function getCommunityActor(userId: string): Promise<CommunityActor> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isAdmin: true,
      displayName: true,
      kennel: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { ownedDogs: true } },
        },
      },
    },
  });

  if (!user) throw new Error("Account not found.");

  return {
    userId: user.id,
    isAdmin: user.isAdmin,
    kennel: user.kennel
      ? {
          id: user.kennel.id,
          name: user.kennel.name,
          slug: user.kennel.slug,
          displayName: user.displayName,
          ownedDogCount: user.kennel._count.ownedDogs,
        }
      : null,
  };
}

export async function getPostingKennelForUser(userId: string): Promise<{
  id: string;
  name: string;
  slug: string;
  isAdmin: boolean;
}> {
  const actor = await getCommunityActor(userId);
  const kennel = actor.kennel;

  if (!kennel) {
    throw new Error("You need a kennel before posting.");
  }

  if (!actor.isAdmin && kennel.ownedDogCount < 1) {
    throw new Error("You need to own at least one dog before posting.");
  }

  return {
    id: kennel.id,
    name: kennel.name,
    slug: kennel.slug,
    isAdmin: actor.isAdmin,
  };
}

export async function listBulletinCategories(args: {
  includeInactive?: boolean;
  includeModerated?: boolean;
} = {}): Promise<BulletinCategoryDto[]> {
  const threadWhere: Prisma.BulletinThreadWhereInput = args.includeModerated
    ? {}
    : VISIBLE_THREAD_WHERE;
  const categories = await db.bulletinCategory.findMany({
    where: args.includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          threads: {
            where: threadWhere,
          },
        },
      },
      threads: {
        where: threadWhere,
        orderBy: [{ pinned: "desc" }, { lastActivityEpoch: "desc" }],
        take: 1,
        select: threadListSelect,
      },
    },
  });
  const latestThreads = categories.flatMap((category) => category.threads);
  const latestById = new Map(
    (await mapThreadRecords(latestThreads)).map((thread) => [thread.id, thread])
  );

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    topicCreationPolicy: category.topicCreationPolicy,
    replyPolicy: category.replyPolicy,
    threadCount: category._count.threads,
    latestThread: category.threads[0]
      ? latestById.get(category.threads[0].id) ?? null
      : null,
  }));
}

const threadListSelect = Prisma.validator<Prisma.BulletinThreadSelect>()({
  id: true,
  title: true,
  sourceType: true,
  status: true,
  pinned: true,
  createdAtEpoch: true,
  lastActivityEpoch: true,
  category: {
    select: {
      slug: true,
      name: true,
      topicCreationPolicy: true,
      replyPolicy: true,
    },
  },
  kennel: {
    select: {
      id: true,
      name: true,
      slug: true,
      user: {
        select: { displayName: true },
      },
    },
  },
  posts: {
    where: { hidden: false, moderationStatus: "VISIBLE" },
    orderBy: [{ createdAtEpoch: "asc" }, { createdAt: "asc" }],
    take: 1,
    select: {
      id: true,
      body: true,
      createdAtEpoch: true,
    },
  },
  _count: {
    select: {
      posts: {
        where: { hidden: false, moderationStatus: "VISIBLE" },
      },
    },
  },
});

export async function listBulletinThreads(args: {
  categorySlug?: string;
  take?: number;
  includeModerated?: boolean;
  includeInactive?: boolean;
} = {}): Promise<BulletinThreadListItem[]> {
  const threads = await db.bulletinThread.findMany({
    where: {
      ...(args.includeModerated
        ? {}
        : VISIBLE_THREAD_WHERE),
      ...(args.includeInactive
        ? args.categorySlug
          ? { category: { slug: args.categorySlug } }
          : {}
        : {
            category: {
              isActive: true,
              ...(args.categorySlug ? { slug: args.categorySlug } : {}),
            },
          }),
    },
    orderBy: [{ pinned: "desc" }, { lastActivityEpoch: "desc" }],
    take: args.take,
    select: threadListSelect,
  });

  return mapThreadRecords(threads);
}

export async function getBulletinCategory(
  slug: string,
  options: { includeInactive?: boolean } = {}
) {
  return db.bulletinCategory.findFirst({
    where: {
      slug,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
      isActive: true,
      topicCreationPolicy: true,
      replyPolicy: true,
    },
  });
}

export async function getBulletinThread(
  threadId: string,
  options: { includeModerated?: boolean } = {}
): Promise<BulletinThreadDetailDto | null> {
  const thread = await db.bulletinThread.findFirst({
    where: {
      id: threadId,
      ...(options.includeModerated
        ? {}
        : { ...VISIBLE_THREAD_WHERE, category: { isActive: true } }),
    },
    select: {
      ...threadListSelect,
      linkedDogId: true,
      linkedShowId: true,
      linkedLitterId: true,
      linkedResultId: true,
      linkedListingId: true,
      posts: {
        where: options.includeModerated
          ? {}
          : { hidden: false, moderationStatus: "VISIBLE" },
        orderBy: [{ createdAtEpoch: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          body: true,
          sourceType: true,
          moderationStatus: true,
          moderationReason: true,
          createdAtEpoch: true,
          kennel: {
            select: {
              id: true,
              name: true,
              slug: true,
              user: {
                select: { displayName: true },
              },
            },
          },
        },
      },
    },
  });

  if (!thread) {
    return null;
  }

  const badgesByKennelId = await badgesForKennels([
    thread.kennel.id,
    ...thread.posts.map((post) => post.kennel.id),
  ]);
  const listItem = mapThreadListItem(thread, badgesByKennelId);

  return {
    ...listItem,
    linkedDogId: thread.linkedDogId,
    linkedShowId: thread.linkedShowId,
    linkedLitterId: thread.linkedLitterId,
    linkedResultId: thread.linkedResultId,
    linkedListingId: thread.linkedListingId,
    posts: thread.posts.map((post) => ({
      id: post.id,
      body: post.body,
      sourceType: post.sourceType,
      moderationStatus: post.moderationStatus,
      moderationReason: post.moderationReason,
      createdAtEpoch: post.createdAtEpoch,
      kennel: {
        id: post.kennel.id,
        name: post.kennel.name,
        slug: post.kennel.slug,
        displayName: post.kennel.user?.displayName ?? null,
      },
      badges:
        badgesByKennelId.get(post.kennel.id) ??
        {
          prestigeScore: 0,
          prestigeRank: "New Kennel",
        },
    })),
  };
}

export async function createBulletinThread(args: {
  kennelId: string;
  isAdmin?: boolean;
  categorySlug: string;
  title: string;
  body: string;
  currentEpoch?: number;
  sourceType?: "PLAYER" | "SYSTEM";
  linkedDogId?: string | null;
  linkedShowId?: string | null;
  linkedLitterId?: string | null;
  linkedResultId?: string | null;
  linkedListingId?: string | null;
}): Promise<string> {
  const title = sanitizeText(args.title, 90);
  const body = sanitizeBody(args.body, 5000);

  if (title.length < 4) {
    throw new Error("Thread title must be at least 4 characters.");
  }

  if (body.length < 2) {
    throw new Error("Post body cannot be empty.");
  }

  const category = await db.bulletinCategory.findFirst({
    where: {
      slug: args.categorySlug,
      isActive: true,
    },
    select: { id: true, topicCreationPolicy: true },
  });

  if (!category) {
    throw new Error("Community category not found.");
  }

  if (
    args.sourceType !== "SYSTEM" &&
    !policyAllows(category.topicCreationPolicy, args.isAdmin ?? false)
  ) {
    throw new Error("You cannot start topics in this category.");
  }

  const currentEpoch = args.currentEpoch ?? getCurrentEpoch();
  const thread = await db.bulletinThread.create({
    data: {
      categoryId: category.id,
      kennelId: args.kennelId,
      title,
      sourceType: args.sourceType ?? "PLAYER",
      status: "OPEN",
      pinned: false,
      createdAtEpoch: currentEpoch,
      lastActivityEpoch: currentEpoch,
      linkedDogId: args.linkedDogId ?? null,
      linkedShowId: args.linkedShowId ?? null,
      linkedLitterId: args.linkedLitterId ?? null,
      linkedResultId: args.linkedResultId ?? null,
      linkedListingId: args.linkedListingId ?? null,
      posts: {
        create: {
          kennelId: args.kennelId,
          body,
          sourceType: args.sourceType ?? "PLAYER",
          createdAtEpoch: currentEpoch,
        },
      },
    },
    select: {
      id: true,
    },
  });

  return thread.id;
}

export async function createSystemBulletinThread(args: {
  categorySlug: string;
  title: string;
  body: string;
  systemKennelId: string;
  currentEpoch?: number;
  linkedDogId?: string | null;
  linkedShowId?: string | null;
  linkedLitterId?: string | null;
  linkedResultId?: string | null;
  linkedListingId?: string | null;
}): Promise<string> {
  return createBulletinThread({
    kennelId: args.systemKennelId,
    categorySlug: args.categorySlug,
    title: args.title,
    body: args.body,
    currentEpoch: args.currentEpoch,
    sourceType: "SYSTEM",
    isAdmin: true,
    linkedDogId: args.linkedDogId,
    linkedShowId: args.linkedShowId,
    linkedLitterId: args.linkedLitterId,
    linkedResultId: args.linkedResultId,
    linkedListingId: args.linkedListingId,
  });
}

export async function createBulletinReply(args: {
  kennelId: string;
  isAdmin?: boolean;
  threadId: string;
  body: string;
  currentEpoch?: number;
}): Promise<string> {
  const body = sanitizeBody(args.body, 5000);

  if (body.length < 2) {
    throw new Error("Reply cannot be empty.");
  }

  const thread = await db.bulletinThread.findFirst({
    where: {
      id: args.threadId,
      status: { in: ["OPEN", "LOCKED"] },
    },
    select: {
      id: true,
      status: true,
      title: true,
      kennelId: true,
      category: {
        select: { slug: true, replyPolicy: true, isActive: true },
      },
    },
  });

  if (!thread) {
    throw new Error("Thread not found.");
  }

  if (!thread.category.isActive && !args.isAdmin) {
    throw new Error("This community category is not active.");
  }

  if (thread.status === "LOCKED" && !args.isAdmin) {
    throw new Error("This thread is locked.");
  }

  if (!policyAllows(thread.category.replyPolicy, args.isAdmin ?? false)) {
    throw new Error("Replies are not allowed in this category.");
  }

  const currentEpoch = args.currentEpoch ?? getCurrentEpoch();

  await db.$transaction(async (tx) => {
    await tx.bulletinPost.create({
      data: {
        threadId: args.threadId,
        kennelId: args.kennelId,
        body,
        sourceType: "PLAYER",
        createdAtEpoch: currentEpoch,
      },
    });

    await tx.bulletinThread.update({
      where: { id: args.threadId },
      data: {
        lastActivityEpoch: currentEpoch,
      },
    });

    if (thread.kennelId !== args.kennelId) {
      const replier = await tx.kennel.findUnique({
        where: { id: args.kennelId },
        select: { name: true },
      });

      await createKennelNotice({
        client: tx,
        kennelId: thread.kennelId,
        type: "BULLETIN_REPLY",
        title: "New bulletin reply",
        body: `${replier?.name ?? "Another kennel"} replied to "${thread.title}".`,
        currentEpoch,
        linkedThreadId: thread.id,
      });
    }
  });

  return thread.category.slug;
}

export async function saveBulletinCategory(args: {
  actor: CommunityActor;
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  topicCreationPolicy: "MEMBERS" | "ADMINS" | "DISABLED";
  replyPolicy: "MEMBERS" | "ADMINS" | "DISABLED";
}): Promise<string> {
  if (!args.actor.isAdmin) throw new Error("Administrator access required.");

  const name = sanitizeText(args.name, 60);
  const slug = sanitizeSlug(args.slug);
  const description = args.description?.trim().slice(0, 240) || null;

  if (name.length < 2) throw new Error("Category name is too short.");
  if (slug.length < 2) throw new Error("Category slug is invalid.");

  if (args.id) {
    const category = await db.bulletinCategory.update({
      where: { id: args.id },
      data: {
        name,
        slug,
        description,
        sortOrder: args.sortOrder,
        isActive: args.isActive,
        topicCreationPolicy: args.topicCreationPolicy,
        replyPolicy: args.replyPolicy,
      },
      select: { slug: true },
    });
    return category.slug;
  }

  const category = await db.bulletinCategory.create({
    data: {
      id: randomUUID(),
      name,
      slug,
      description,
      sortOrder: args.sortOrder,
      isActive: args.isActive,
      topicCreationPolicy: args.topicCreationPolicy,
      replyPolicy: args.replyPolicy,
    },
    select: { slug: true },
  });
  return category.slug;
}

export type BulletinTopicModerationAction =
  | "PIN"
  | "UNPIN"
  | "LOCK"
  | "UNLOCK"
  | "HIDE"
  | "RESTORE"
  | "DELETE";

export async function moderateBulletinTopic(args: {
  actor: CommunityActor;
  threadId: string;
  action: BulletinTopicModerationAction;
  reason?: string | null;
}): Promise<string> {
  if (!args.actor.isAdmin) throw new Error("Administrator access required.");

  const thread = await db.bulletinThread.findUnique({
    where: { id: args.threadId },
    select: { category: { select: { slug: true } } },
  });
  if (!thread) throw new Error("Topic not found.");

  const stateByAction = {
    LOCK: "LOCKED",
    UNLOCK: "OPEN",
    HIDE: "HIDDEN",
    RESTORE: "OPEN",
    DELETE: "DELETED",
  } as const;
  const status = args.action in stateByAction
    ? stateByAction[args.action as keyof typeof stateByAction]
    : undefined;
  const pinned = args.action === "PIN" ? true : args.action === "UNPIN" ? false : undefined;

  await db.bulletinThread.update({
    where: { id: args.threadId },
    data: {
      ...(status ? { status } : {}),
      ...(pinned === undefined ? {} : { pinned }),
      moderatedByUserId: args.actor.userId,
      moderatedAt: new Date(),
      moderationReason: args.reason?.trim().slice(0, 240) || null,
    },
  });

  return thread.category.slug;
}

export type BulletinPostModerationAction = "HIDE" | "RESTORE" | "DELETE";

export async function moderateBulletinPost(args: {
  actor: CommunityActor;
  postId: string;
  action: BulletinPostModerationAction;
  reason?: string | null;
}): Promise<{ threadId: string; categorySlug: string }> {
  if (!args.actor.isAdmin) throw new Error("Administrator access required.");

  const post = await db.bulletinPost.findUnique({
    where: { id: args.postId },
    select: {
      threadId: true,
      thread: { select: { category: { select: { slug: true } } } },
    },
  });
  if (!post) throw new Error("Post not found.");

  const moderationStatus =
    args.action === "RESTORE"
      ? "VISIBLE"
      : args.action === "HIDE"
        ? "HIDDEN"
        : "DELETED";

  await db.bulletinPost.update({
    where: { id: args.postId },
    data: {
      moderationStatus,
      hidden: moderationStatus !== "VISIBLE",
      moderatedByUserId: args.actor.userId,
      moderatedAt: new Date(),
      moderationReason: args.reason?.trim().slice(0, 240) || null,
    },
  });

  return {
    threadId: post.threadId,
    categorySlug: post.thread.category.slug,
  };
}
