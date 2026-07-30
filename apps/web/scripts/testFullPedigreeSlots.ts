import fs from "node:fs";
import path from "node:path";

import type { DogProfilePedigreeDogDto } from "../server/mappers/dog.mapper";
import { buildFourGenerationPedigreeSlots } from "../components/dogs/pedigreeSlots";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function ancestor(
  relationship: string,
  dogId = relationship,
  progenyCount = 0,
  hasFullClearance = true
): DogProfilePedigreeDogDto {
  return {
    dogId,
    displayName: relationship,
    relationship,
    profileUrl: `/dogs/${dogId}`,
    registrationNumber: `REG-${dogId}`,
    sex: relationship.endsWith("Dam") ? "F" : "M",
    storedCoiPercent: 4.25,
    progenyCount,
    healthTestsSummary: "Health tests: 5/5",
    healthStatusMarkers: {
      badgeStatus: hasFullClearance ? "green" : "red",
      hasFullClearance,
    },
    colorLabel: "Color: Pending",
    detailedHealthResults: [],
    healthSeverityCounts: null,
  };
}

const shallow = buildFourGenerationPedigreeSlots([
  ancestor("Sire"),
  ancestor("Dam"),
]);
assert(shallow.length === 30, "four generations must always create 30 slots");
assert(shallow.filter((slot) => slot.ancestor).length === 2, "shallow pedigree has two populated slots");
assert(shallow.filter((slot) => !slot.ancestor).length === 28, "shallow pedigree has 28 Unknown slots");
assert(new Set(shallow.map((slot) => slot.column)).size === 4, "all four columns remain present");

const positions = ["S", "D", "SS", "SD", "DS", "DD", "SSS", "SSD", "SDS", "SDD", "DSS", "DSD", "DDS", "DDD", "SSSS", "SSSD", "SSDS", "SSDD", "SDSS", "SDSD", "SDDS", "SDDD", "DSSS", "DSSD", "DSDS", "DSDD", "DDSS", "DDSD", "DDDS", "DDDD"];
const full = buildFourGenerationPedigreeSlots(
  positions.map((position) => ancestor(position.split("").map((part) => part === "S" ? "Sire" : "Dam").join("'s "), position))
);
assert(full.every((slot) => slot.ancestor), "complete pedigree fills all 30 positions");
assert(full.find((slot) => slot.position === "SD")?.ancestor?.dogId === "SD", "branches do not shift positions");

const partial = buildFourGenerationPedigreeSlots([
  ancestor("Sire"),
  ancestor("Dam"),
  ancestor("Sire's Sire"),
]);
assert(partial.find((slot) => slot.position === "SS")?.ancestor, "partial branch keeps its known ancestor");
assert(!partial.find((slot) => slot.position === "SD")?.ancestor, "partial branch keeps an Unknown slot without shifting");

const repeated = buildFourGenerationPedigreeSlots([
  ancestor("Sire"),
  ancestor("Dam"),
  ancestor("Sire's Sire", "repeat"),
  ancestor("Dam's Dam", "repeat"),
]);
assert(repeated.find((slot) => slot.position === "SS")?.ancestor?.dogId === "repeat", "repeated sire-side ancestor remains in SS");
assert(repeated.find((slot) => slot.position === "DD")?.ancestor?.dogId === "repeat", "repeated dam-side ancestor remains in DD");

const progeny = buildFourGenerationPedigreeSlots([
  ancestor("Sire", "zero-progeny", 0),
  ancestor("Dam", "many-progeny", 12),
]);
assert(progeny.find((slot) => slot.position === "S")?.ancestor?.progenyCount === 0, "zero progeny is retained");
assert(progeny.find((slot) => slot.position === "D")?.ancestor?.progenyCount === 12, "multiple progeny is retained");

const healthStates = buildFourGenerationPedigreeSlots([
  ancestor("Sire", "clear", 0, true),
  ancestor("Dam", "adverse", 0, false),
]);
assert(healthStates.find((slot) => slot.position === "S")?.ancestor?.healthStatusMarkers.hasFullClearance, "full-clearance ancestor is retained");
assert(healthStates.find((slot) => slot.position === "D")?.ancestor?.healthStatusMarkers.badgeStatus === "red", "adverse public-health status is retained");

const serviceSource = fs.readFileSync(path.join(process.cwd(), "server/services/dog.service.ts"), "utf8");
assert(serviceSource.includes("progenyCount: 0"), "pedigree DTO initializes a progeny count");
assert(serviceSource.includes("OR: [") && serviceSource.includes("sireId: { in: ancestorIds }") && serviceSource.includes("damId: { in: ancestorIds }"), "progeny counts use one batched parent lookup");
assert(!serviceSource.includes("ancestor.progenyCount = await"), "pedigree progeny counts do not use per-card queries");

console.log("Full pedigree slot checks passed.");
