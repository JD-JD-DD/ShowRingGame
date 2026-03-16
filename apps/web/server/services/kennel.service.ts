import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentEpoch } from "@/lib/gameClock";

const createKennelSchema = z.object({
  name: z.string().trim().min(2).max(60),
  homeDistrict: z.coerce.number().int().min(1).max(15).optional(),
});

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getStarterFunds(): number {
  const raw = process.env.STARTER_FUNDS ?? '25000';
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('STARTER_FUNDS must be a non-negative number.');
  }

  return Math.floor(parsed);
}

function getDefaultHomeDistrict(): number {
  const raw = process.env.DEFAULT_HOME_DISTRICT ?? '4';
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 15) {
    throw new Error('DEFAULT_HOME_DISTRICT must be an integer between 1 and 15.');
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

  const name = parsed.name.trim();
  const baseSlug = slugify(name);

  if (!baseSlug) {
    throw new Error("Kennel name must contain letters or numbers.");
  }

  const duplicateName = await db.kennel.findUnique({
    where: { name },
    select: { id: true },
  });

  if (duplicateName) {
    throw new Error("That kennel name is already taken.");
  }

  let slug = baseSlug;
  let suffix = 2;

  while (await db.kennel.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const homeDistrict = parsed.homeDistrict ?? getDefaultHomeDistrict();
  const starterFunds = getStarterFunds();

  const kennel = await db.$transaction(async (tx) => {
    const createdKennel = await tx.kennel.create({
      data: {
        userId,
        name,
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

    return createdKennel;
  });

  return kennel;
}

export async function getKennelForUser(userId: string) {
  return db.kennel.findFirst({
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
}
