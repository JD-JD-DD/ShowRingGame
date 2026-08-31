// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { CURRENT_BREED_RELEASE } from "@showring/rules";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { STANDARD_BREED_ARTWORK_CAMPAIGN_KEY } from "../prisma/artCampaignSeed";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const RETIRED_COMPATIBILITY_CODES = ["SO", "RC", "QE", "QM"] as const;

type BreedAuditRow = {
  code2: string;
  name: string;
  groupName: string | null;
  releaseVersion: number | null;
  isActive: boolean;
};

function groupName(value: string | null) {
  return value ?? "Unassigned";
}

function countByGroup(rows: BreedAuditRow[]) {
  return new Map<string, number>(rows.reduce((counts, row) => counts.set(groupName(row.groupName), (counts.get(groupName(row.groupName)) ?? 0) + 1), new Map<string, number>()));
}

function canonicalSourceCounts() {
  const rows = readFileSync(join(process.cwd(), "prisma/data/breeds.csv"), "utf8").split(/\r?\n/).filter(Boolean).slice(1);
  const eligible = rows.map((row) => {
    const [name, code2, group, , releaseVersion] = row.split(",");
    return { code2, name, groupName: group, releaseVersion: Number(releaseVersion) };
  }).filter((row) => row.releaseVersion <= CURRENT_BREED_RELEASE);
  return new Map<string, number>(eligible.reduce((counts, row) => counts.set(row.groupName, (counts.get(row.groupName) ?? 0) + 1), new Map<string, number>()));
}

async function main() {
  const eligibilityWhere = { isActive: true, releaseVersion: { lte: CURRENT_BREED_RELEASE } };
  const [eligibleBreeds, standardCampaigns, retiredBreeds] = await Promise.all([
    prisma.breed.findMany({
      where: eligibilityWhere,
      select: { code2: true, name: true, groupName: true, releaseVersion: true, isActive: true, artCampaigns: { where: { campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY }, select: { id: true } } },
      orderBy: [{ groupName: "asc" }, { name: "asc" }],
    }),
    prisma.artCampaign.findMany({
      where: { campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY },
      select: { breedCode2: true, breed: { select: { code2: true, name: true, groupName: true, releaseVersion: true, isActive: true } } },
      orderBy: { breedCode2: "asc" },
    }),
    prisma.breed.findMany({
      where: { code2: { in: [...RETIRED_COMPATIBILITY_CODES] } },
      select: { code2: true, name: true, groupName: true, releaseVersion: true, isActive: true, artCampaigns: { where: { campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY }, select: { id: true } } },
      orderBy: { code2: "asc" },
    }),
  ]);

  const eligibleRows: BreedAuditRow[] = eligibleBreeds;
  const eligibleCampaigns = eligibleBreeds.flatMap((breed) => breed.artCampaigns.map(() => breed));
  const missingCampaigns = eligibleBreeds.filter((breed) => breed.artCampaigns.length === 0);
  const expectedByGroup = canonicalSourceCounts();
  const eligibleByGroup = countByGroup(eligibleRows);
  const campaignsByGroup = countByGroup(eligibleCampaigns);
  const missingByGroup = new Map<string, BreedAuditRow[]>(missingCampaigns.reduce((groups, breed) => {
    const group = groupName(breed.groupName);
    groups.set(group, [...(groups.get(group) ?? []), breed]);
    return groups;
  }, new Map<string, BreedAuditRow[]>()));
  const groups = [...new Set([...expectedByGroup.keys(), ...eligibleByGroup.keys(), ...campaignsByGroup.keys()])].sort((left, right) => left.localeCompare(right)).map((group) => {
    const expected = expectedByGroup.get(group) ?? 0;
    const eligible = eligibleByGroup.get(group) ?? 0;
    return {
      group,
      sourceExpectedEligibleBreeds: expected,
      databaseEligibleBreeds: eligible,
      databaseStandardCampaigns: campaignsByGroup.get(group) ?? 0,
      missingCampaigns: missingByGroup.get(group) ?? [],
      breedDatabaseClassification: eligible === expected ? "DB matches canonical source" : eligible < expected ? "DB Breed rows short" : "DB Breed rows exceed source",
    };
  });
  const unexpectedCampaigns = standardCampaigns.filter((campaign) => !campaign.breed.isActive || campaign.breed.releaseVersion === null || campaign.breed.releaseVersion > CURRENT_BREED_RELEASE).map((campaign) => campaign.breed);

  console.log(JSON.stringify({
    currentBreedRelease: CURRENT_BREED_RELEASE,
    totalDatabaseEligibleBreeds: eligibleBreeds.length,
    totalStandardCampaignsForEligibleBreeds: eligibleCampaigns.length,
    totalMissingCampaigns: missingCampaigns.length,
    totalUnexpectedIneligibleCampaigns: unexpectedCampaigns.length,
    groups,
    toy: groups.find((group) => group.group === "Toy") ?? null,
    sporting: groups.find((group) => group.group === "Sporting") ?? null,
    unexpectedIneligibleCampaigns: unexpectedCampaigns,
    retiredCompatibilityRecords: retiredBreeds.map((breed) => ({
      code2: breed.code2,
      name: breed.name,
      releaseVersion: breed.releaseVersion,
      isActive: breed.isActive,
      eligible: breed.isActive && breed.releaseVersion !== null && breed.releaseVersion <= CURRENT_BREED_RELEASE,
      standardCampaignCount: breed.artCampaigns.length,
    })),
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Breed Art campaign population audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
