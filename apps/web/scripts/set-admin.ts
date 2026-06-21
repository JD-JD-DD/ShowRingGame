import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
const value = process.argv[3]?.trim().toLowerCase() ?? "true";

if (!email || !["true", "false"].includes(value)) {
  console.error("Usage: npm --workspace apps/web run admin:set -- player@example.com [true|false]");
  process.exit(1);
}

const db = new PrismaClient();

try {
  const user = await db.user.update({
    where: { email },
    data: { isAdmin: value === "true" },
    select: { email: true, isAdmin: true },
  });
  console.log(`${user.email}: isAdmin=${user.isAdmin}`);
} finally {
  await db.$disconnect();
}
