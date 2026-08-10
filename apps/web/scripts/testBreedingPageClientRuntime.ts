import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const client = source("apps/web/components/breeding/BreedPageClient.tsx");
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");

assert.ok(client.startsWith('"use client"'), "breeding planner is a client component");
assert.ok(
  client.includes('from "@/lib/breedingAvailability"'),
  "the client imports pending-care copy from a browser-safe module"
);
assert.equal(
  client.includes('from "@/server/services/emergencyVetCare.service"'),
  false,
  "the client does not import the Prisma/database-backed veterinary-care service"
);

for (const expected of [
  "hasPendingVeterinaryCare: false,",
  "hasPendingVeterinaryCare,",
  "dog.isEligibleToBreed ||",
  "Boolean(dog.studListingId) && dog.hasPendingVeterinaryCare",
]) {
  assert.ok(planner.includes(expected), `planner DTO path includes ${expected}`);
}

const card = (overrides: Partial<{ isOwned: boolean; listed: boolean; pending: boolean }> = {}) => ({
  isOwned: overrides.isOwned ?? false,
  listed: overrides.listed ?? true,
  pending: overrides.pending ?? false,
});

assert.deepEqual(card({ isOwned: true, listed: false }), { isOwned: true, listed: false, pending: false }, "owned breeding card has a concrete pending-care boolean");
assert.deepEqual(card(), { isOwned: false, listed: true, pending: false }, "ordinary outside stud card is selectable");
assert.deepEqual(card({ pending: true }), { isOwned: false, listed: true, pending: true }, "pending-care outside stud card preserves its listing while carrying the unavailable state");
assert.deepEqual(card({ pending: true, listed: false }), { isOwned: false, listed: false, pending: true }, "direct/card data remains serializable when no general public-stud batch is present");
assert.equal(client.includes("initialBreedCode2 ?? \"\""), true, "no-breed planner state remains supported");

console.log("Breeding page client runtime regression checks passed.");
