import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = readFileSync(join(root, "apps/web/server/services/studContractPuppySelection.service.ts"), "utf8");
for (const fragment of ["getStudContractPuppySelectionDeadlines", "epochToDate(bornEpoch + 24)", "epochToDate(bornEpoch + 48)", 'status: "STUD_PICK"', 'currentActor: "STUD_OWNER"', 'status: "DAM_FIRST_PICK"', 'currentActor: "DAM_OWNER"', 'status: "WAITING"']) assert.ok(source.includes(fragment), fragment);
assert.equal(source.includes("NEONATAL_PUPPY_DEATH_WINDOW_HOURS"), false);
console.log("Stud Contract fixed puppy-selection deadline checks passed.");
