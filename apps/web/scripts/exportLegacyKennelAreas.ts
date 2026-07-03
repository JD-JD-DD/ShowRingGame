import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

function loadLocalEnv() {
  const cwd = process.cwd();
  const root = cwd.endsWith(join("apps", "web")) ? resolve(cwd, "..", "..") : cwd;
  const candidates = [join(root, ".env"), join(root, "apps", "web", ".env")];

  for (const path of candidates) {
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key]) continue;

      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadLocalEnv();

const db = new PrismaClient();

type CsvValue = string | number | boolean | null | undefined | Date;

function timestampForFile(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  const text = value instanceof Date ? value.toISOString() : String(value);

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv<T extends Record<string, CsvValue>>(
  rows: T[],
  columns: Array<keyof T>
): string {
  const header = columns.map((column) => csvEscape(String(column))).join(",");
  const body = rows.map((row) =>
    columns.map((column) => csvEscape(row[column])).join(",")
  );

  return [header, ...body].join("\n") + "\n";
}

function resolveExportDir(): string {
  const cwd = process.cwd();

  return cwd.endsWith(join("apps", "web"))
    ? resolve(cwd, "exports")
    : resolve(cwd, "apps", "web", "exports");
}

async function main() {
  const exportedAt = new Date();
  const stamp = timestampForFile(exportedAt);
  const exportDir = resolveExportDir();

  const areas = await db.kennelArea.findMany({
    orderBy: [{ kennelId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      kennelId: true,
      name: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      kennel: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
      dogs: {
        orderBy: [{ dogId: "asc" }],
        select: {
          id: true,
          kennelAreaId: true,
          dogId: true,
          addedAt: true,
          dog: {
            select: {
              id: true,
              callName: true,
              registeredName: true,
              regNumber: true,
              breedCode2: true,
              ownerKennelId: true,
              breed: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const areaRows = areas.map((area) => ({
    areaId: area.id,
    kennelId: area.kennelId,
    kennelName: area.kennel.name,
    ownerUserId: area.kennel.userId,
    areaName: area.name,
    sortOrder: area.sortOrder,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
    dogMembershipCount: area.dogs.length,
  }));

  const membershipRows = areas.flatMap((area) =>
    area.dogs.map((membership) => ({
      areaId: area.id,
      areaName: area.name,
      kennelId: area.kennelId,
      kennelName: area.kennel.name,
      dogId: membership.dogId,
      dogCallName: membership.dog.callName,
      dogRegisteredName: membership.dog.registeredName,
      dogRegNumber: membership.dog.regNumber,
      breedCode: membership.dog.breedCode2,
      breedName: membership.dog.breed.name,
      dogOwnerKennelId: membership.dog.ownerKennelId,
      addedAt: membership.addedAt,
    }))
  );

  const nested = {
    exportedAt: exportedAt.toISOString(),
    source: "KennelArea/KennelAreaDog legacy archive before Kennel Runs schema cleanup",
    counts: {
      areas: areaRows.length,
      memberships: membershipRows.length,
      distinctKennels: new Set(areaRows.map((row) => row.kennelId)).size,
      distinctDogs: new Set(membershipRows.map((row) => row.dogId)).size,
    },
    areas: areas.map((area) => ({
      id: area.id,
      kennelId: area.kennelId,
      kennelName: area.kennel.name,
      ownerUserId: area.kennel.userId,
      name: area.name,
      sortOrder: area.sortOrder,
      createdAt: area.createdAt.toISOString(),
      updatedAt: area.updatedAt.toISOString(),
      dogMembershipCount: area.dogs.length,
      memberships: area.dogs.map((membership) => ({
        areaId: area.id,
        areaName: area.name,
        kennelId: area.kennelId,
        kennelName: area.kennel.name,
        dogId: membership.dogId,
        dogCallName: membership.dog.callName,
        dogRegisteredName: membership.dog.registeredName,
        dogRegNumber: membership.dog.regNumber,
        breedCode: membership.dog.breedCode2,
        breedName: membership.dog.breed.name,
        dogOwnerKennelId: membership.dog.ownerKennelId,
        addedAt: membership.addedAt.toISOString(),
      })),
    })),
  };

  const jsonPath = join(exportDir, `legacy-kennel-areas-${stamp}.json`);
  const areasCsvPath = join(exportDir, `legacy-kennel-areas-${stamp}.csv`);
  const membershipsCsvPath = join(
    exportDir,
    `legacy-kennel-area-memberships-${stamp}.csv`
  );

  await mkdir(exportDir, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, JSON.stringify(nested, null, 2) + "\n", "utf8"),
    writeFile(
      areasCsvPath,
      toCsv(areaRows, [
        "areaId",
        "kennelId",
        "kennelName",
        "ownerUserId",
        "areaName",
        "sortOrder",
        "createdAt",
        "updatedAt",
        "dogMembershipCount",
      ]),
      "utf8"
    ),
    writeFile(
      membershipsCsvPath,
      toCsv(membershipRows, [
        "areaId",
        "areaName",
        "kennelId",
        "kennelName",
        "dogId",
        "dogCallName",
        "dogRegisteredName",
        "dogRegNumber",
        "breedCode",
        "breedName",
        "dogOwnerKennelId",
        "addedAt",
      ]),
      "utf8"
    ),
  ]);

  console.log(
    JSON.stringify(
      {
        areasExported: nested.counts.areas,
        membershipsExported: nested.counts.memberships,
        distinctKennels: nested.counts.distinctKennels,
        distinctDogs: nested.counts.distinctDogs,
        outputPaths: {
          json: jsonPath,
          areasCsv: areasCsvPath,
          membershipsCsv: membershipsCsvPath,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Legacy kennel area export failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
