import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const careService = source("apps/web/server/services/emergencyVetCare.service.ts");
const header = source("apps/web/components/EmergencyCareLink.tsx");
const breeding = source("apps/web/server/services/breeding.service.ts");
const showEntries = source("apps/web/server/services/showEntry.service.ts");

assert.ok(careService.includes("export type PendingVeterinaryCare"));
assert.ok(careService.includes('careType: "ACCIDENT_ILLNESS"'));
assert.ok(careService.includes('careType: "REPRODUCTIVE_EMERGENCY"'));
assert.ok(careService.includes("getPendingVeterinaryCareForDog"));
assert.ok(careService.includes("hasPendingVeterinaryCareForDog"));
assert.ok(careService.includes("assertDogHasNoPendingVeterinaryCare"));
assert.ok(careService.includes("client.reproductiveEmergencyEvent.findFirst"));
assert.ok(careService.includes("responseDeadlineEpoch - right.responseDeadlineEpoch"));
assert.ok(careService.includes("destinationHref: `/dogs/${reproductive.damId}#whelping-emergency`"));
assert.ok(breeding.includes("assertDogHasNoPendingVeterinaryCare(dam.id, tx)"));
assert.ok(showEntries.includes("assertDogHasNoPendingVeterinaryCare(dog.id, tx)"));
assert.ok(showEntries.includes('reproductiveEmergencies: { some: { status: { in: ["PENDING", "TREATMENT_AUTHORIZED"] } } }'));
assert.ok(header.includes('status: { in: ["PENDING", "TREATMENT_AUTHORIZED"] }'));
assert.ok(header.includes("reproductiveEmergencyEvent.findMany"));
assert.ok(header.includes("left.responseDeadlineEpoch - right.responseDeadlineEpoch"));
assert.ok(header.includes("#whelping-emergency"));
assert.ok(!careService.includes("authorizeEmergencyTreatment({\n  kennelId: args.kennelId"));
console.log("Pending veterinary-care source checks passed.");
