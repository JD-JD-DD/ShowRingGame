import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

type ModerationCommand =
  | "close-kennel"
  | "ban-user"
  | "ban-ip"
  | "reopen-kennel"
  | "unban-ip";

function loadEnv(): void {
  for (const root of [process.cwd(), resolve(process.cwd(), "..", "..")]) {
    for (const fileName of [".env.local", ".env"]) {
      const envPath = resolve(root, fileName);
      if (existsSync(envPath)) config({ path: envPath, override: false });
    }
  }
}

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid or missing value for ${name ?? "(argument)"}.`);
    }
    flags.set(name, value.trim());
  }

  return flags;
}

function requireFlag(flags: Map<string, string>, name: string): string {
  const value = flags.get(name);
  if (!value) throw new Error(`Missing required flag: ${name}`);
  return value;
}

function usage(command: ModerationCommand): string {
  const commands: Record<ModerationCommand, string> = {
    "close-kennel": "--slug <slug> --reason \"<reason>\"",
    "ban-user": "--user-id <id> --reason \"<reason>\"",
    "ban-ip":
      "--ip <ip> --reason \"<reason>\" [--expires-at <ISO date/time>]",
    "reopen-kennel": "--slug <slug> --reason \"<reason>\"",
    "unban-ip": "--ip <ip> --reason \"<reason>\"",
  };
  return `${command} ${commands[command]} [--moderated-by <label>]`;
}

export async function runModerationCli(
  command: ModerationCommand
): Promise<void> {
  loadEnv();

  let flags: Map<string, string>;
  try {
    flags = parseFlags(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(`Usage: ${usage(command)}`);
    process.exitCode = 1;
    return;
  }

  const reason = flags.get("--reason");
  if (!reason) {
    console.error(`Usage: ${usage(command)}`);
    process.exitCode = 1;
    return;
  }

  const moderatedBy =
    flags.get("--moderated-by") ||
    process.env.SHOWRING_MODERATOR_LABEL?.trim() ||
    "admin-cli";
  const db = new PrismaClient();

  try {
    if (command === "close-kennel" || command === "reopen-kennel") {
      const slug = requireFlag(flags, "--slug");
      const kennel = await db.kennel.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!kennel) throw new Error(`Kennel not found: ${slug}`);

      const closing = command === "close-kennel";
      await db.$transaction([
        db.kennel.update({
          where: { id: kennel.id },
          data: closing
            ? {
                moderationStatus: "CLOSED",
                moderationReason: reason,
                moderatedAt: new Date(),
                moderatedBy,
              }
            : {
                moderationStatus: "ACTIVE",
                moderationReason: null,
                moderatedAt: null,
                moderatedBy: null,
              },
        }),
        db.moderationAudit.create({
          data: {
            targetType: "KENNEL",
            targetId: kennel.id,
            action: closing ? "KENNEL_CLOSED" : "KENNEL_REOPENED",
            reason,
            moderatorLabel: moderatedBy,
          },
        }),
      ]);
      console.log(`${closing ? "Closed" : "Reopened"} kennel ${slug}.`);
      return;
    }

    if (command === "ban-user") {
      const userId = requireFlag(flags, "--user-id");
      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: {
            moderationStatus: "BANNED",
            moderationReason: reason,
            moderatedAt: new Date(),
            moderatedBy,
          },
        }),
        db.moderationAudit.create({
          data: {
            targetType: "USER",
            targetId: userId,
            action: "USER_BANNED",
            reason,
            moderatorLabel: moderatedBy,
          },
        }),
      ]);
      console.log(`Banned user ${userId}.`);
      return;
    }

    const ipAddress = requireFlag(flags, "--ip");

    if (command === "ban-ip") {
      const expiresAtText = flags.get("--expires-at");
      const expiresAt = expiresAtText ? new Date(expiresAtText) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        throw new Error("--expires-at must be a valid ISO date/time.");
      }

      await db.$transaction(async (tx) => {
        await tx.accessDenylist.updateMany({
          where: { ipAddress, isActive: true },
          data: { isActive: false },
        });
        await tx.accessDenylist.create({
          data: {
            ipAddress,
            reason,
            createdBy: moderatedBy,
            expiresAt,
          },
        });
        await tx.moderationAudit.create({
          data: {
            targetType: "IP",
            targetId: ipAddress,
            action: "IP_BANNED",
            reason,
            moderatorLabel: moderatedBy,
          },
        });
      });
      console.log(`Banned IP ${ipAddress}.`);
      return;
    }

    await db.$transaction(async (tx) => {
      await tx.accessDenylist.updateMany({
        where: { ipAddress, isActive: true },
        data: { isActive: false },
      });
      await tx.moderationAudit.create({
        data: {
          targetType: "IP",
          targetId: ipAddress,
          action: "IP_UNBANNED",
          reason,
          moderatorLabel: moderatedBy,
        },
      });
    });
    console.log(`Unbanned IP ${ipAddress}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
