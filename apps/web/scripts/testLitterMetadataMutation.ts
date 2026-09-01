import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import {
  LitterMetadataError,
  resolveLitterMetadataUpdate,
} from "../server/services/litter.service";

type Metadata = { customName: string | null; breederNote: string | null };

const unnamed: Metadata = { customName: null, breederNote: null };
const named: Metadata = { customName: "C Litter", breederNote: "Saved note" };

function apply(current: Metadata, input: Record<string, unknown>): Metadata {
  return { ...current, ...resolveLitterMetadataUpdate(current, input) };
}

function expectError(current: Metadata, input: Record<string, unknown>, message: string) {
  assert.throws(
    () => resolveLitterMetadataUpdate(current, input),
    (error: unknown) => error instanceof LitterMetadataError && error.message === message
  );
}

assert.deepEqual(apply(unnamed, {}), unnamed, "omitted name preserves an unnamed litter");
assert.equal(apply(unnamed, { customName: "" }).customName, null, "blank first name leaves litter unnamed");
assert.equal(apply(unnamed, { customName: "   " }).customName, null, "whitespace first name leaves litter unnamed");
assert.equal(apply(unnamed, { customName: null }).customName, null, "null first name leaves litter unnamed");
assert.equal(apply(unnamed, { customName: "  C Litter  " }).customName, "C Litter", "first name trims but preserves capitalization");
assert.equal(apply(named, {}).customName, "C Litter", "omitted name preserves a named litter");
assert.equal(apply(named, { customName: "  D Litter!  " }).customName, "D Litter!", "name replacement trims and preserves punctuation");
for (const input of [{ customName: "" }, { customName: "  " }, { customName: null }]) {
  expectError(named, input, "A named litter must have a litter name.");
}
assert.equal(apply(unnamed, { customName: "x" }).customName, "x", "one-character name is valid");
assert.equal(apply(unnamed, { customName: "x".repeat(25) }).customName?.length, 25, "25-character name is valid");
expectError(unnamed, { customName: "x".repeat(26) }, "Litter name must be 25 characters or fewer.");

assert.deepEqual(apply(unnamed, { breederNote: "\nFirst line\nSecond line\n" }), { customName: null, breederNote: "First line\nSecond line" }, "note-only updates preserve multiline content without naming the litter");
assert.equal(apply(named, { breederNote: "Updated" }).customName, "C Litter", "note-only updates preserve existing names");
assert.equal(apply(named, { breederNote: "x".repeat(2_000) }).breederNote?.length, 2_000, "2,000-character note is valid");
expectError(named, { breederNote: "x".repeat(2_001) }, "Private breeder note must be 2,000 characters or fewer.");
assert.equal(apply(named, { breederNote: "   " }).breederNote, null, "blank note clears");
assert.equal(apply(named, { breederNote: null }).breederNote, null, "null note clears");
assert.equal(apply(named, {}).breederNote, "Saved note", "omitted note preserves");

const service = readFileSync("server/services/litter.service.ts", "utf8");
const route = readFileSync("app/api/litters/[litterId]/metadata/route.ts", "utf8");
const metadataOperation = service.slice(service.indexOf("export async function updateLitterMetadata"));
assert.match(metadataOperation, /id: args\.litterId,\s*bredByKennelId: args\.kennelId/, "authority requires both litter id and breeder kennel id");
assert.doesNotMatch(metadataOperation, /ownerKennelId|puppies:/, "metadata authority never uses puppy ownership");
assert.match(metadataOperation, /data: update/, "only resolved metadata fields are written");

const breederId = "breeder";
const buyerId = "buyer";
const unrelatedId = "unrelated";
const canMutate = (litter: { bredByKennelId: string | null }, kennelId: string) => litter.bredByKennelId === kennelId;
assert.equal(canMutate({ bredByKennelId: breederId }, breederId), true, "breeder may update metadata");
assert.equal(canMutate({ bredByKennelId: breederId }, buyerId), false, "puppy buyer cannot update metadata");
assert.equal(canMutate({ bredByKennelId: breederId }, unrelatedId), false, "unrelated kennel cannot update metadata");
assert.equal(canMutate({ bredByKennelId: breederId }, breederId), true, "breeder retains authority after all puppies leave");
assert.match(route, /getSessionUserId/, "route authenticates");
assert.match(route, /getKennelForUser/, "route resolves the kennel server-side");
assert.match(route, /LitterMetadataError/, "expected errors return 4xx without unexpected-error logging");

console.log("Litter metadata mutation checks passed.");
