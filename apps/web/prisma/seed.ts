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

    const code2 = row.code2.trim();
    const name = row.breed_name.trim();
    const data = {
      code2,
      name,
      groupName: row.group.trim(),
      isActive: isReleased,
      releaseVersion,
    };
    const existingByCode = await prisma.breed.findUnique({
      where: { code2 },
      select: { code2: true },
    });

    if (existingByCode) {
      await prisma.breed.update({
        where: { code2 },
        data,
      });
      continue;
    }

    const existingByName = await prisma.breed.findUnique({
      where: { name },
      select: { name: true },
    });

    if (existingByName) {
      await prisma.breed.update({
        where: { name },
        data,
      });
      continue;
    }

    await prisma.breed.create({ data });
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
