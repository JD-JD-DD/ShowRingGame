import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const editor = readFileSync("components/litters/LitterMetadataEditor.tsx", "utf8");
const page = readFileSync("app/litters/[litterId]/page.tsx", "utf8");
const puppyCards = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const puppyCard = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");
const litterCards = readFileSync("components/litters/LitterCards.tsx", "utf8");
const littersPage = readFileSync("app/litters/page.tsx", "utf8");

assert.match(editor, /^"use client";/, "metadata editor is the narrow client boundary");
assert.match(editor, /getLitterDisplayName\(customName, serial7\)/, "read state uses the canonical display helper");
assert.match(editor, /Serial \{serial7\}/, "named litters show serial as secondary identity");
assert.match(editor, /type="button"[\s\S]*?Edit/, "read state has an Edit button");
assert.match(editor, /<form onSubmit=\{saveMetadata\}/, "edit state is inline semantic form");
assert.match(editor, /maxLength=\{25\}/, "name input has client length assistance");
assert.match(editor, /maxLength=\{2000\}/, "note textarea has client length assistance");
assert.match(editor, /Only your kennel can see this note\./g, "privacy copy appears in read and edit state");
assert.match(editor, /whitespace-pre-wrap/, "note read state preserves line breaks");
assert.match(editor, /method: "PATCH"/, "save reuses PATCH");
assert.match(editor, /\/api\/litters\/\$\{litterId\}\/metadata/, "save reuses the canonical metadata endpoint");
assert.match(editor, /role="alert"/, "server validation errors are announced inline");
assert.match(editor, /role="status"[\s\S]*aria-live="polite"/, "success feedback is announced");
assert.match(editor, /setNameInput\(customName \?\? ""\)/, "cancel restores latest persisted name");
assert.match(editor, /setNoteInput\(breederNote \?\? ""\)/, "cancel restores latest persisted note");
assert.doesNotMatch(editor, /Remove Name|removeName|deleteName/, "there is no name-removal control");
assert.doesNotMatch(editor, /Modal|Popover|Drawer/, "editor has no overlay interaction");

assert.match(page, /<LitterMetadataEditor[\s\S]*breederNote=\{litter\.breederNote\}/, "private note is passed only to metadata editor");
assert.match(page, /<LitterPuppyCardsClient litterId=\{litter\.litterId\} puppies=\{litter\.puppies\}/, "puppy grid remains separate");
for (const source of [puppyCards, puppyCard]) {
  assert.doesNotMatch(source, /breederNote/, "private notes never cross the puppy-grid boundary");
}
assert.match(litterCards, /getLitterDisplayName\(litter\.customName, litter\.serial7\)/, "Whelped Litter cards use the shared display helper");
assert.match(littersPage, /getLitterDisplayName\(selection\.litter\.customName, selection\.litter\.serial7\)/, "stud-contract heading uses the shared display helper");
assert.match(page, /export default async function LitterDetailPage/, "Litter Record remains server-rendered");
assert.match(page, /litterId=\{litter\.litterId\}/, "editor receives immutable id routing identity");

console.log("Litter metadata editor checks passed.");
