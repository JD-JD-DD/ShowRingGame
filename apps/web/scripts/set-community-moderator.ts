import { PrismaClient } from "@prisma/client";

const userId = process.argv[2]?.trim();
const value = process.argv[3]?.trim().toLowerCase() ?? "true";

if (!userId || !["true", "false"].includes(value)) {
  console.error("Usage: npm --workspace apps/web exec tsx scripts/set-community-moderator.ts <user-id> [true|false]");
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { isCommunityModerator: value === "true" },
      select: { id: true, isAdmin: true, isCommunityModerator: true },
    });
    console.log(`${user.id}: isAdmin=${user.isAdmin}, isCommunityModerator=${user.isCommunityModerator}`);
  } finally {
    await db.$disconnect();
  }
}

void main();
