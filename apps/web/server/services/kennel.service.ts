import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { applyBetaBalanceTopUpToKennel } from "@/lib/betaEconomy";
import { getCurrentEpoch } from "@/lib/gameClock";
import { ensureStarterKennelRuns } from "@/server/services/kennelRun.service";

const KENNEL_NAME_MIN_LENGTH = 2;
const KENNEL_NAME_MAX_LENGTH = 45;
const KENNEL_SLUG_MAX_LENGTH = 40;

const RESERVED_KENNEL_SLUGS = new Set([
  "admin",
  "administrator",
  "moderator",
  "official",
  "show-ring",
  "show-ring-game",
  "showring",
  "support",
  "system",
]);

const createKennelSchema = z.object({
  name: z.string(),
  homeDistrict: z.coerce.number().int().min(1).max(15).optional(),
});

export type KennelNameValidationResult =
  | {
      ok: true;
      name: string;
      slugBase: string;
    }
  | {
      ok: false;
      code: "INVALID_NAME" | "PROHIBITED_NAME";
      message: string;
    };

export class KennelRenameError extends Error {
  constructor(
    readonly code:
      | "KENNEL_NOT_FOUND"
      | "UNAUTHORIZED_OWNERSHIP"
      | "RENAME_ALREADY_USED"
      | "NAME_ALREADY_TAKEN"
      | "INVALID_NAME"
      | "PROHIBITED_NAME"
      | "MODERATION_RESTRICTED"
      | "NO_ACTUAL_NAME_CHANGE",
    message: string
  ) {
    super(message);
    this.name = "KennelRenameError";
  }
}

type KennelClient = Pick<
  Prisma.TransactionClient,
  "kennel" | "kennelRenameHistory" | "ledgerTransaction"
>;

type KennelRootClient = KennelClient & {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

function normalizeKennelName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function slugifyKennelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, KENNEL_SLUG_MAX_LENGTH);
}

export function validateKennelName(rawName: unknown): KennelNameValidationResult {
  const name = normalizeKennelName(String(rawName ?? ""));

  if (
    name.length < KENNEL_NAME_MIN_LENGTH ||
    name.length > KENNEL_NAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      code: "INVALID_NAME",
      message: `Kennel name must be ${KENNEL_NAME_MIN_LENGTH}-${KENNEL_NAME_MAX_LENGTH} characters long.`,
    };
  }

  const slugBase = slugifyKennelName(name);

  if (!slugBase) {
    return {
      ok: false,
      code: "INVALID_NAME",
      message: "Kennel name must contain letters or numbers.",
    };
  }

  if (RESERVED_KENNEL_SLUGS.has(slugBase)) {
    return {
      ok: false,
      code: "PROHIBITED_NAME",
      message: "That kennel name is not allowed.",
    };
  }

  return {
    ok: true,
    name,
    slugBase,
  };
}

async function isKennelNameTaken(args: {
  client: KennelClient;
  name: string;
  excludeKennelId?: string;
}): Promise<boolean> {
  const existing = await args.client.kennel.findFirst({
    where: {
      ...(args.excludeKennelId ? { id: { not: args.excludeKennelId } } : {}),
      name: {
        equals: args.name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

async function isKennelSlugUnavailable(args: {
  client: KennelClient;
  slug: string;
  excludeKennelId?: string;
}): Promise<boolean> {
  const [existingKennel, existingHistory] = await Promise.all([
    args.client.kennel.findFirst({
      where: {
        slug: args.slug,
        ...(args.excludeKennelId ? { id: { not: args.excludeKennelId } } : {}),
      },
      select: { id: true },
    }),
    args.client.kennelRenameHistory.findFirst({
      where: {
        OR: [{ previousSlug: args.slug }, { newSlug: args.slug }],
        ...(args.excludeKennelId
          ? { kennelId: { not: args.excludeKennelId } }
          : {}),
      },
      select: { id: true },
    }),
  ]);

  return Boolean(existingKennel || existingHistory);
}

export async function generateUniqueKennelSlug(args: {
  client?: KennelClient;
  name: string;
  excludeKennelId?: string;
}): Promise<string> {
  const client = args.client ?? db;
  const validation = validateKennelName(args.name);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  let slug = validation.slugBase;
  let suffix = 2;

  while (
    await isKennelSlugUnavailable({
      client,
      slug,
      excludeKennelId: args.excludeKennelId,
    })
  ) {
    slug = `${validation.slugBase}-${suffix}`.slice(0, KENNEL_SLUG_MAX_LENGTH);
    suffix += 1;
  }

  return slug;
}

function getStarterFunds(): number {
  const raw = process.env.STARTER_FUNDS ?? "25000";
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("STARTER_FUNDS must be a non-negative number.");
  }

  return Math.floor(parsed);
}

function getDefaultHomeDistrict(): number {
  const raw = process.env.DEFAULT_HOME_DISTRICT ?? "4";
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 15) {
    throw new Error("DEFAULT_HOME_DISTRICT must be an integer between 1 and 15.");
  }

  return parsed;
}

export async function createKennelForUser(userId: string, input: unknown) {
  const parsed = createKennelSchema.parse(input);
  const currentEpoch = getCurrentEpoch();

  const existingKennel = await db.kennel.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (existingKennel) {
    throw new Error("This account already has a kennel.");
  }

  const validation = validateKennelName(parsed.name);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const duplicateName = await isKennelNameTaken({
    client: db,
    name: validation.name,
  });

  if (duplicateName) {
    throw new Error("That kennel name is already taken.");
  }

  const slug = await generateUniqueKennelSlug({
    client: db,
    name: validation.name,
  });

  const homeDistrict = parsed.homeDistrict ?? getDefaultHomeDistrict();
  const starterFunds = getStarterFunds();

  const kennel = await db.$transaction(async (tx) => {
    const createdKennel = await tx.kennel.create({
      data: {
        userId,
        name: validation.name,
        slug,
        balance: starterFunds,
        homeDistrict,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        balance: true,
        homeDistrict: true,
        createdAt: true,
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        kennelId: createdKennel.id,
        transactionType: "STARTER_FUNDS",
        amount: starterFunds,
        balanceAfter: starterFunds,
        occurredAtEpoch: currentEpoch,
        memo: "Starter funds granted at kennel creation.",
      },
    });

    await ensureStarterKennelRuns({
      kennelId: createdKennel.id,
      client: tx,
    });

    return createdKennel;
  });

  return kennel;
}

export async function renameKennel(args: {
  userId: string;
  kennelId?: string;
  newName: unknown;
  source?: "SELF_SERVICE" | "ADMIN";
  client?: KennelRootClient;
}) {
  const source = args.source ?? "SELF_SERVICE";
  const validation = validateKennelName(args.newName);

  if (!validation.ok) {
    throw new KennelRenameError(validation.code, validation.message);
  }

  const client = (args.client ?? db) as KennelRootClient;
  const renamedKennel = await client.$transaction(
    async (tx: Prisma.TransactionClient) => {
    const kennel = await tx.kennel.findFirst({
      where: {
        ...(args.kennelId ? { id: args.kennelId } : { userId: args.userId }),
      },
      select: {
        id: true,
        userId: true,
        isNpc: true,
        name: true,
        slug: true,
        moderationStatus: true,
        user: {
          select: {
            moderationStatus: true,
          },
        },
      },
    });

    if (!kennel) {
      throw new KennelRenameError(
        "KENNEL_NOT_FOUND",
        "Kennel not found."
      );
    }

    if (kennel.userId !== args.userId || kennel.isNpc) {
      throw new KennelRenameError(
        "UNAUTHORIZED_OWNERSHIP",
        "You do not own this kennel."
      );
    }

    if (
      kennel.moderationStatus === "CLOSED" ||
      kennel.user?.moderationStatus === "BANNED"
    ) {
      throw new KennelRenameError(
        "MODERATION_RESTRICTED",
        "This account or kennel cannot be updated right now."
      );
    }

    if (normalizeKennelName(kennel.name).toLowerCase() === validation.name.toLowerCase()) {
      throw new KennelRenameError(
        "NO_ACTUAL_NAME_CHANGE",
        "Enter a different kennel name to rename your kennel."
      );
    }

    if (source === "SELF_SERVICE") {
      const priorSelfServiceRename = await tx.kennelRenameHistory.findFirst({
        where: {
          kennelId: kennel.id,
          source: "SELF_SERVICE",
        },
        select: { id: true },
      });

      if (priorSelfServiceRename) {
        throw new KennelRenameError(
          "RENAME_ALREADY_USED",
          "This self-service kennel name change has already been used."
        );
      }
    }

    const duplicateName = await isKennelNameTaken({
      client: tx,
      name: validation.name,
      excludeKennelId: kennel.id,
    });

    if (duplicateName) {
      throw new KennelRenameError(
        "NAME_ALREADY_TAKEN",
        "That kennel name is already taken."
      );
    }

    const newSlug = await generateUniqueKennelSlug({
      client: tx,
      name: validation.name,
      excludeKennelId: kennel.id,
    });

    await tx.kennelRenameHistory.create({
      data: {
        kennelId: kennel.id,
        previousName: kennel.name,
        previousSlug: kennel.slug,
        newName: validation.name,
        newSlug,
        source,
      },
    });

    return tx.kennel.update({
      where: { id: kennel.id },
      data: {
        name: validation.name,
        slug: newSlug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
    }
  );

  return renamedKennel;
}

export async function getKennelForUser(userId: string) {
  const kennel = await db.kennel.findFirst({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      balance: true,
      homeDistrict: true,
      createdAt: true,
      _count: {
        select: {
          ownedDogs: true,
        },
      },
    },
  });

  return applyBetaBalanceTopUpToKennel(kennel, getCurrentEpoch());
}
