import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { Prisma } from "@prisma/client";

const STUD_LISTING_TYPES = ["STUD", "STUD_SERVICE", "PLAYER_STUD"] as const;
const SALE_LISTING_TYPES = ["PLAYER_PUBLIC"] as const;

export const BULLETIN_CATEGORIES = [
  {
    id: "general",
    slug: "general",
    name: "General",
    description: "General kennel chat and game discussion.",
    sortOrder: 10,
  },
  {
    id: "show-judges-discussion",
    slug: "show-judges-discussion",
    name: "Show/Judges Discussion",
    description: "Discuss shows, judging trends, and ring observations.",
    sortOrder: 20,
  },
  {
    id: "brags-wins-new-titles",
    slug: "brags-wins-new-titles",
    name: "Brags & Wins/New Titles",
    description: "Share wins, title progress, and proud kennel moments.",
    sortOrder: 30,
  },
  {
    id: "litter-announcements",
    slug: "litter-announcements",
    name: "Litter Announcements",
    description: "Announce new litters and puppy availability.",
    sortOrder: 40,
  },
  {
    id: "stud-ads",
    slug: "stud-ads",
    name: "Stud Ads",
    description: "Advertise dogs that are actively listed at stud.",
    sortOrder: 50,
  },
  {
    id: "questions-bugs-help",
    slug: "questions-bugs-help",
    name: "Questions/Bugs/Help",
    description: "Ask questions, report bugs, and help other players.",
    sortOrder: 60,
  },
] as const;

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
  };
  kennel: {
    id: string;
    name: string;
    slug: string;
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
  championCount: number;
  dogsAtStudCount: number;
  dogsForSaleCount: number;
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
  };
  kennel: {
    id: string;
    name: string;
    slug: string;
  };
  badges: KennelPrestigeBadges;
};

export type BulletinCategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  threadCount: number;
  latestThread: BulletinThreadListItem | null;
};

export type BulletinPostDto = {
  id: string;
  body: string;
  sourceType: string;
  createdAtEpoch: number;
  kennel: {
    id: string;
    name: string;
    slug: string;
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
      championCount: 0,
      dogsAtStudCount: 0,
      dogsForSaleCount: 0,
    });
  }

  await Promise.all(
    uniqueKennelIds.map(async (kennelId) => {
      const [championCount, dogsAtStudCount, dogsForSaleCount] =
        await Promise.all([
          db.dogTitleProgress.count({
            where: {
              currentTitleCode: "CH",
              dog: {
                OR: [{ ownerKennelId: kennelId }, { breederKennelId: kennelId }],
              },
            },
          }),
          db.dogListing.count({
            where: {
              sellerKennelId: kennelId,
              status: "ACTIVE",
              listingType: { in: [...STUD_LISTING_TYPES] },
            },
          }),
          db.dogListing.count({
            where: {
              sellerKennelId: kennelId,
              status: "ACTIVE",
              listingType: { in: [...SALE_LISTING_TYPES] },
            },
          }),
        ]);

      result.set(kennelId, {
        championCount,
        dogsAtStudCount,
        dogsForSaleCount,
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
    kennel: thread.kennel,
    badges:
      badgesByKennelId.get(thread.kennel.id) ??
      {
        championCount: 0,
        dogsAtStudCount: 0,
        dogsForSaleCount: 0,
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

export async function ensureBulletinCategories() {
  await Promise.all(
    BULLETIN_CATEGORIES.map((category) =>
      db.bulletinCategory.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
        create: {
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      })
    )
  );
}

export async function getPostingKennelForUser(userId: string): Promise<{
  id: string;
  name: string;
  slug: string;
}> {
  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          ownedDogs: true,
        },
      },
    },
  });

  if (!kennel) {
    throw new Error("You need a kennel before posting.");
  }

  if (kennel._count.ownedDogs < 1) {
    throw new Error("You need to own at least one dog before posting.");
  }

  return {
    id: kennel.id,
    name: kennel.name,
    slug: kennel.slug,
  };
}

export async function listBulletinCategories(): Promise<BulletinCategoryDto[]> {
  await ensureBulletinCategories();

  const categories = await db.bulletinCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          threads: {
            where: {
              status: {
                not: "HIDDEN",
              },
            },
          },
        },
      },
      threads: {
        where: {
          status: {
            not: "HIDDEN",
          },
        },
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
    },
  },
  kennel: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  posts: {
    where: { hidden: false },
    orderBy: [{ createdAtEpoch: "asc" }],
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
        where: { hidden: false },
      },
    },
  },
});

export async function listBulletinThreads(args: {
  categorySlug?: string;
  take?: number;
} = {}): Promise<BulletinThreadListItem[]> {
  await ensureBulletinCategories();

  const threads = await db.bulletinThread.findMany({
    where: {
      status: {
        not: "HIDDEN",
      },
      ...(args.categorySlug
        ? {
            category: {
              slug: args.categorySlug,
              isActive: true,
            },
          }
        : {}),
    },
    orderBy: [{ pinned: "desc" }, { lastActivityEpoch: "desc" }],
    take: args.take,
    select: threadListSelect,
  });

  return mapThreadRecords(threads);
}

export async function getBulletinCategory(slug: string) {
  await ensureBulletinCategories();

  return db.bulletinCategory.findFirst({
    where: {
      slug,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });
}

export async function getBulletinThread(
  threadId: string
): Promise<BulletinThreadDetailDto | null> {
  const thread = await db.bulletinThread.findFirst({
    where: {
      id: threadId,
      status: {
        not: "HIDDEN",
      },
    },
    select: {
      ...threadListSelect,
      linkedDogId: true,
      linkedShowId: true,
      linkedLitterId: true,
      linkedResultId: true,
      linkedListingId: true,
      posts: {
        where: { hidden: false },
        orderBy: [{ createdAtEpoch: "asc" }],
        select: {
          id: true,
          body: true,
          sourceType: true,
          createdAtEpoch: true,
          kennel: {
            select: {
              id: true,
              name: true,
              slug: true,
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
      createdAtEpoch: post.createdAtEpoch,
      kennel: post.kennel,
      badges:
        badgesByKennelId.get(post.kennel.id) ??
        {
          championCount: 0,
          dogsAtStudCount: 0,
          dogsForSaleCount: 0,
        },
    })),
  };
}

export async function createBulletinThread(args: {
  kennelId: string;
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
  await ensureBulletinCategories();

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
    select: { id: true },
  });

  if (!category) {
    throw new Error("Bulletin category not found.");
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
    linkedDogId: args.linkedDogId,
    linkedShowId: args.linkedShowId,
    linkedLitterId: args.linkedLitterId,
    linkedResultId: args.linkedResultId,
    linkedListingId: args.linkedListingId,
  });
}

export async function createBulletinReply(args: {
  kennelId: string;
  threadId: string;
  body: string;
  currentEpoch?: number;
}): Promise<void> {
  const body = sanitizeBody(args.body, 5000);

  if (body.length < 2) {
    throw new Error("Reply cannot be empty.");
  }

  const thread = await db.bulletinThread.findFirst({
    where: {
      id: args.threadId,
      status: {
        not: "HIDDEN",
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!thread) {
    throw new Error("Thread not found.");
  }

  if (thread.status === "LOCKED") {
    throw new Error("This thread is locked.");
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
  });
}
