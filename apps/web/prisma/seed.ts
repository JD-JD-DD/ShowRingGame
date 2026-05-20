import { PrismaClient } from "@prisma/client";
import { CURRENT_BREED_RELEASE } from "@showring/rules";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

type BreedRow = {
  breed_name: string;
  code2: string;
  group: string;
  playable: string;
  release_version: string;
};

async function main() {
  const filePath = path.join(process.cwd(), "prisma/data/breeds.csv");

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  lines.shift(); // remove header

  const rows: BreedRow[] = lines.map((line) => {
    const [breed_name, code2, group, playable, release_version] = line.split(",");

    return {
      breed_name,
      code2,
      group,
      playable,
      release_version,
    };
  });

  for (const row of rows) {
    const releaseVersion = Number(row.release_version.trim()) || null;
    const isReleased =
      releaseVersion !== null && releaseVersion <= CURRENT_BREED_RELEASE;

    await prisma.breed.upsert({
      where: {
        code2: row.code2.trim(),
      },
      update: {
        name: row.breed_name.trim(),
        groupName: row.group.trim(),
        isActive: isReleased,
        releaseVersion,
      },
      create: {
        code2: row.code2.trim(),
        name: row.breed_name.trim(),
        groupName: row.group.trim(),
        isActive: isReleased,
        releaseVersion,
      },
    });
  }

  console.log(`Seeded ${rows.length} breeds`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
