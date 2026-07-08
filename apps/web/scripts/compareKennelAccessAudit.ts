import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type AuditEvent = {
  id: string;
  userId: string | null;
  kennelId: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  path: string | null;
  createdAt: Date;
};

function loadEnv() {
  for (const root of [process.cwd(), resolve(process.cwd(), "..", "..")]) {
    for (const fileName of [".env.local", ".env"]) {
      const envPath = resolve(root, fileName);

      if (existsSync(envPath)) {
        config({ path: envPath, override: false });
      }
    }
  }
}

function usage(): never {
  console.error(
    "Usage: npm --workspace apps/web run audit:kennel-access -- <kennel-slug-a> <kennel-slug-b> [--admin-include-emails]"
  );
  process.exit(1);
}

function formatDate(date: Date): string {
  return date.toISOString();
}

function formatMaybe(value: string | null | undefined): string {
  return value?.trim() ? value : "(none)";
}

function summarizeValues(
  label: string,
  first: AuditEvent[],
  second: AuditEvent[],
  getValue: (event: AuditEvent) => string | null
) {
  const firstValues = new Map<string, number>();
  const secondValues = new Map<string, number>();

  for (const event of first) {
    const value = getValue(event);
    if (value) firstValues.set(value, (firstValues.get(value) ?? 0) + 1);
  }

  for (const event of second) {
    const value = getValue(event);
    if (value) secondValues.set(value, (secondValues.get(value) ?? 0) + 1);
  }

  const matches = Array.from(firstValues.keys())
    .filter((value) => secondValues.has(value))
    .sort();

  console.log(`\nMatching ${label}:`);

  if (matches.length === 0) {
    console.log("  (none)");
    return;
  }

  for (const value of matches) {
    console.log(
      `  ${value} | first=${firstValues.get(value)} second=${secondValues.get(
        value
      )}`
    );
  }
}

function formatEvent(event: AuditEvent): string {
  return [
    formatDate(event.createdAt),
    event.action,
    `userId=${formatMaybe(event.userId)}`,
    `kennelId=${formatMaybe(event.kennelId)}`,
    `ip=${formatMaybe(event.ipAddress)}`,
    `ua=${formatMaybe(event.userAgent)}`,
    `path=${formatMaybe(event.path)}`,
  ].join(" | ");
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const includeEmails = args.includes("--admin-include-emails");
  const unknownFlags = args.filter(
    (arg) => arg.startsWith("--") && arg !== "--admin-include-emails"
  );
  const slugs = args.filter((arg) => !arg.startsWith("--"));

  if (unknownFlags.length > 0 || slugs.length !== 2) {
    usage();
  }

  const db = new PrismaClient();

  try {
    const kennels = await Promise.all(
      slugs.map((slug) =>
        db.kennel.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            slug: true,
            userId: true,
            createdAt: true,
            user: includeEmails
              ? {
                  select: {
                    email: true,
                  },
                }
              : false,
          },
        })
      )
    );

    const missing = kennels
      .map((kennel, index) => (kennel ? null : slugs[index]))
      .filter(Boolean);

    if (missing.length > 0) {
      throw new Error(`Kennel slug not found: ${missing.join(", ")}`);
    }

    const [firstKennel, secondKennel] = kennels;

    if (!firstKennel || !secondKennel) {
      throw new Error("Unable to load both kennels.");
    }

    console.log("Kennels:");
    for (const kennel of [firstKennel, secondKennel]) {
      const parts = [
        `${kennel.name} (${kennel.slug})`,
        `userId=${formatMaybe(kennel.userId)}`,
        `kennelId=${kennel.id}`,
        `createdAt=${formatDate(kennel.createdAt)}`,
      ];

      if (includeEmails) {
        parts.push(`email=${formatMaybe(kennel.user?.email)}`);
      }

      console.log(`  ${parts.join(" | ")}`);
    }

    const auditSelect = {
      id: true,
      userId: true,
      kennelId: true,
      action: true,
      ipAddress: true,
      userAgent: true,
      path: true,
      createdAt: true,
    };

    const [firstEvents, secondEvents] = await Promise.all(
      [firstKennel, secondKennel].map((kennel) =>
        db.userAccessAudit.findMany({
          where: {
            OR: [
              { kennelId: kennel.id },
              ...(kennel.userId ? [{ userId: kennel.userId }] : []),
            ],
          },
          select: auditSelect,
          orderBy: { createdAt: "asc" },
        })
      )
    );

    console.log(
      `\nAudit event counts: ${firstKennel.slug}=${firstEvents.length}, ${secondKennel.slug}=${secondEvents.length}`
    );

    summarizeValues("IPs", firstEvents, secondEvents, (event) => event.ipAddress);
    summarizeValues("user-agent strings", firstEvents, secondEvents, (event) =>
      event.userAgent
    );

    const nearTimePairs = [];

    for (const firstEvent of firstEvents) {
      for (const secondEvent of secondEvents) {
        const deltaMs = Math.abs(
          firstEvent.createdAt.getTime() - secondEvent.createdAt.getTime()
        );

        if (deltaMs <= ONE_DAY_MS) {
          nearTimePairs.push({
            firstEvent,
            secondEvent,
            deltaMs,
          });
        }
      }
    }

    nearTimePairs.sort((left, right) => left.deltaMs - right.deltaMs);

    console.log("\nNear-time access events within 24 hours:");

    if (nearTimePairs.length === 0) {
      console.log("  (none)");
      return;
    }

    for (const pair of nearTimePairs) {
      const deltaHours = (pair.deltaMs / (60 * 60 * 1000)).toFixed(2);
      console.log(`  deltaHours=${deltaHours}`);
      console.log(`    ${firstKennel.slug}: ${formatEvent(pair.firstEvent)}`);
      console.log(`    ${secondKennel.slug}: ${formatEvent(pair.secondEvent)}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
