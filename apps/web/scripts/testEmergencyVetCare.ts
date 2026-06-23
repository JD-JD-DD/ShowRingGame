import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type DogEmergencyCareEvent, type Prisma } from "@prisma/client";
import {
  calculateEmergencyVetCareDeadlineEpoch,
  createPendingEmergencyForAccidentIllnessDeath,
  EMERGENCY_VET_CARE_COST_TIERS,
  EMERGENCY_VET_CARE_RESPONSE_WINDOW_HOURS,
  getEmergencyVetCareCostTierWeightTotalBps,
  selectEmergencyVetCareCostTier,
  selectEmergencyVetCareCostTierFromRollBps,
  selectTreatmentSurvivalOutcomeFromRollBps,
  toPendingEmergencyCarePayload,
  assertDogHasNoPendingEmergencyCare,
  type EmergencyVetCareClient,
} from "../server/services/emergencyVetCare.service";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function assertBefore(
  haystack: string,
  first: string,
  second: string,
  label: string
): void {
  const firstIndex = haystack.indexOf(first);
  const secondIndex = haystack.indexOf(second);

  assert.ok(firstIndex >= 0, `${label}: missing first marker`);
  assert.ok(secondIndex >= 0, `${label}: missing second marker`);
  assert.ok(firstIndex < secondIndex, label);
}

function assertDoesNotInclude(
  haystack: string,
  needle: string,
  label: string
): void {
  assert.equal(haystack.includes(needle), false, label);
}

function createFakeEmergencyVetCareClient(
  events: DogEmergencyCareEvent[]
): EmergencyVetCareClient {
  return {
    dogEmergencyCareEvent: {
      async findFirst(args) {
        const where = args.where;

        return (
          events.find(
            (event) =>
              event.dogId === where?.dogId &&
              event.status === where?.status
          ) ?? null
        );
      },
      async create(args) {
        const data =
          args.data as Prisma.DogEmergencyCareEventUncheckedCreateInput;
        const now = new Date(0);
        const event: DogEmergencyCareEvent = {
          id: `emergency-${events.length + 1}`,
          dogId: data.dogId,
          kennelIdAtEvent: data.kennelIdAtEvent ?? null,
          emergencyType: data.emergencyType,
          status: data.status ?? "PENDING",
          createdAtEpoch: data.createdAtEpoch,
          responseDeadlineEpoch: data.responseDeadlineEpoch,
          treatmentCost: data.treatmentCost,
          survivalChanceBps: data.survivalChanceBps,
          paidAtEpoch: data.paidAtEpoch ?? null,
          resolvedAtEpoch: data.resolvedAtEpoch ?? null,
          treatmentOutcome: data.treatmentOutcome ?? null,
          ledgerTransactionId: data.ledgerTransactionId ?? null,
          showIneligibleUntilEpoch: data.showIneligibleUntilEpoch ?? null,
          breedIneligibleUntilEpoch: data.breedIneligibleUntilEpoch ?? null,
          lifetimeBreedIneligible: data.lifetimeBreedIneligible ?? false,
          traitModifierJson: null,
          outcomeSeed: data.outcomeSeed ?? null,
          outcomeRollBps: data.outcomeRollBps ?? null,
          canceledAtEpoch: data.canceledAtEpoch ?? null,
          canceledReason: data.canceledReason ?? null,
          createdAt: now,
          updatedAt: now,
        };

        events.push(event);
        return event;
      },
    },
  };
}

assert.equal(
  getEmergencyVetCareCostTierWeightTotalBps(),
  10_000,
  "emergency cost tier weights total 100%"
);
assert.deepEqual(
  EMERGENCY_VET_CARE_COST_TIERS.map((tier) => [
    tier.treatmentCost,
    tier.chanceBps,
    tier.survivalChanceBps,
  ]),
  [
    [3_000, 5_000, 9_500],
    [5_000, 2_000, 9_000],
    [7_500, 1_200, 8_200],
    [10_000, 800, 7_200],
    [12_500, 500, 6_200],
    [15_000, 500, 5_000],
  ],
  "emergency cost tiers match approved cost and survival table"
);
assert.equal(
  selectEmergencyVetCareCostTierFromRollBps(0).treatmentCost,
  3_000,
  "lowest roll selects first cost tier"
);
assert.equal(
  selectEmergencyVetCareCostTierFromRollBps(4_999).treatmentCost,
  3_000,
  "first tier includes its upper weighted boundary"
);
assert.equal(
  selectEmergencyVetCareCostTierFromRollBps(5_000).treatmentCost,
  5_000,
  "second tier starts after first tier weight"
);
assert.equal(
  selectEmergencyVetCareCostTierFromRollBps(9_999).treatmentCost,
  15_000,
  "highest roll selects final cost tier"
);
assert.equal(
  selectEmergencyVetCareCostTier(0.5).treatmentCost,
  5_000,
  "random roll input maps deterministically to a cost tier"
);
assert.equal(
  selectTreatmentSurvivalOutcomeFromRollBps({
    survivalChanceBps: 9_500,
    rollBps: 9_499,
  }),
  "SURVIVED",
  "survival roll below survival chance survives"
);
assert.equal(
  selectTreatmentSurvivalOutcomeFromRollBps({
    survivalChanceBps: 9_500,
    rollBps: 9_500,
  }),
  "DIED_DESPITE_TREATMENT",
  "survival roll at threshold dies"
);
assert.equal(
  calculateEmergencyVetCareDeadlineEpoch(1_000),
  1_000 + EMERGENCY_VET_CARE_RESPONSE_WINDOW_HOURS,
  "response deadline is 48 hours after creation"
);

const lifecycleService = source("apps/web/server/services/lifecycle.service.ts");
const emergencyVetCareService = source(
  "apps/web/server/services/emergencyVetCare.service.ts"
);
const treatRoute = source(
  "apps/web/app/api/dogs/[dogId]/emergency-care/treat/route.ts"
);
const declineRoute = source(
  "apps/web/app/api/dogs/[dogId]/emergency-care/decline/route.ts"
);
const expirationJobRoute = source(
  "apps/web/app/api/jobs/process-emergency-vet-care/route.ts"
);
const showEntryService = source("apps/web/server/services/showEntry.service.ts");
const breedingService = source("apps/web/server/services/breeding.service.ts");
const marketService = source("apps/web/server/services/market.service.ts");
const groomingService = source("apps/web/server/services/grooming.service.ts");
const rehomeService = source("apps/web/server/services/rehome.service.ts");

assertIncludes(
  lifecycleService,
  "createPendingEmergencyForAccidentIllnessDeath",
  "lifecycle service imports the emergency creation helper"
);
assertIncludes(
  lifecycleService,
  'if (cause === "ACCIDENT_ILLNESS")',
  "lifecycle service has a scoped accident/illness emergency branch"
);
assertBefore(
  lifecycleService,
  'if (cause === "ACCIDENT_ILLNESS")',
  "const changed = await markDogDeceased({",
  "accident/illness emergency branch runs before death finalization"
);
assertIncludes(
  lifecycleService,
  "continue;",
  "accident/illness branch skips immediate death finalization"
);
assertIncludes(
  lifecycleService,
  'cause: "AGE"',
  "age death projection remains present"
);
assertIncludes(
  lifecycleService,
  'cause: "NEONATAL_PUPPY"',
  "neonatal puppy death projection remains present"
);
assertIncludes(
  lifecycleService,
  '"WHELPING_DAM"',
  "whelping dam death cause remains present"
);
assertIncludes(
  emergencyVetCareService,
  "export async function authorizeEmergencyTreatment",
  "emergency service exposes treatment authorization"
);
assertIncludes(
  emergencyVetCareService,
  "export async function declineEmergencyCare",
  "emergency service exposes decline handling"
);
assertIncludes(
  emergencyVetCareService,
  "export async function processExpiredEmergencyCareEvents",
  "emergency service exposes expiration processing"
);
assertIncludes(
  emergencyVetCareService,
  'transactionType: "EMERGENCY_VET_CARE"',
  "treatment creates an emergency vet-care ledger transaction"
);
assertIncludes(
  emergencyVetCareService,
  'status: "PENDING"',
  "resolution paths guard pending emergency status"
);
assertIncludes(
  emergencyVetCareService,
  'treatmentOutcome === "SURVIVED" ? "TREATED_SURVIVED" : "TREATED_DIED"',
  "treatment can resolve to survived status"
);
assertIncludes(
  emergencyVetCareService,
  'treatmentOutcome === "SURVIVED" ? "TREATED_SURVIVED" : "TREATED_DIED"',
  "treatment can resolve to died status"
);
assertIncludes(
  emergencyVetCareService,
  'status: "DECLINED_DIED"',
  "decline resolves to declined died status"
);
assertIncludes(
  emergencyVetCareService,
  'status: "EXPIRED_DIED"',
  "expiration resolves to expired died status"
);
assertIncludes(
  emergencyVetCareService,
  "Insufficient funds for emergency vet care.",
  "treatment rejects insufficient funds"
);
assertIncludes(
  emergencyVetCareService,
  "Emergency care deadline has passed.",
  "treatment rejects expired pending emergencies"
);
assertIncludes(
  emergencyVetCareService,
  "markEmergencyDogDeceased",
  "death outcomes use existing lifecycle death finalization"
);
assertIncludes(
  emergencyVetCareService,
  'cause: "ACCIDENT_ILLNESS"',
  "emergency deaths currently use the existing accident/illness death cause"
);
assertDoesNotInclude(
  emergencyVetCareService,
  "SURVIVED_SHOW_INELIGIBLE_3_MONTHS",
  "phase 1 treatment does not roll temporary show restriction outcomes"
);
assertDoesNotInclude(
  emergencyVetCareService,
  "SURVIVED_TRAIT_MODIFIER",
  "phase 1 treatment does not roll trait modifier outcomes"
);
assertIncludes(
  treatRoute,
  "authorizeEmergencyTreatment",
  "treatment route calls backend treatment authorization"
);
assertIncludes(
  treatRoute,
  "getSessionUserId",
  "treatment route requires an authenticated user"
);
assertIncludes(
  declineRoute,
  "declineEmergencyCare",
  "decline route calls backend decline handling"
);
assertIncludes(
  declineRoute,
  "getSessionUserId",
  "decline route requires an authenticated user"
);
assertIncludes(
  expirationJobRoute,
  "SHOWRING_JOBS_SECRET",
  "expiration job uses the existing job secret convention"
);
assertIncludes(
  expirationJobRoute,
  "processExpiredEmergencyCareEvents",
  "expiration job calls backend expiration processing"
);
assertIncludes(
  showEntryService,
  "assertDogHasNoPendingEmergencyCare(dog.id, tx)",
  "show entry creation blocks pending emergency care"
);
assertIncludes(
  breedingService,
  "assertDogHasNoPendingEmergencyCare(dam.id, tx)",
  "breeding blocks pending emergency care for dams"
);
assertIncludes(
  breedingService,
  "assertDogHasNoPendingEmergencyCare(sire.id, tx)",
  "breeding and stud use block pending emergency care for sires"
);
assertIncludes(
  marketService,
  "assertDogHasNoPendingEmergencyCare(dog.id, tx)",
  "sale and stud listing creation block pending emergency care"
);
assertIncludes(
  marketService,
  "assertDogHasNoPendingEmergencyCare(listing.dog.id, tx)",
  "sale transfer blocks pending emergency care"
);
assertIncludes(
  groomingService,
  "assertDogHasNoPendingEmergencyCare(dog.id, tx)",
  "self-groom and grooming-listing creation block pending emergency care"
);
assertIncludes(
  groomingService,
  "assertDogHasNoPendingEmergencyCare(listing.dog.id, tx)",
  "outside grooming job acceptance blocks pending emergency care"
);
assertIncludes(
  rehomeService,
  "assertDogHasNoPendingEmergencyCare(dogId, tx)",
  "rehome transfer blocks pending emergency care"
);

async function main(): Promise<void> {
  const events: DogEmergencyCareEvent[] = [];
  const fakeClient = createFakeEmergencyVetCareClient(events);
  const firstEmergency = await createPendingEmergencyForAccidentIllnessDeath({
    dogId: "dog-1",
    kennelIdAtEvent: "kennel-1",
    createdAtEpoch: 1_000,
    costRollBps: 0,
    outcomeSeed: "seed-1",
    client: fakeClient,
  });
  const secondEmergency = await createPendingEmergencyForAccidentIllnessDeath({
    dogId: "dog-1",
    kennelIdAtEvent: "kennel-1",
    createdAtEpoch: 1_100,
    costRollBps: 9_999,
    outcomeSeed: "seed-2",
    client: fakeClient,
  });

  assert.equal(
    firstEmergency.id,
    secondEmergency.id,
    "pending emergency creation reuses an existing pending event"
  );
  assert.equal(events.length, 1, "pending emergency creation is idempotent");
  assert.equal(
    firstEmergency.emergencyType,
    "ACCIDENT_ILLNESS",
    "created emergency uses accident/illness type"
  );
  assert.equal(
    firstEmergency.status,
    "PENDING",
    "created emergency starts pending"
  );
  assert.equal(
    firstEmergency.responseDeadlineEpoch,
    1_048,
    "created emergency stores a 48-hour response deadline"
  );

  const payload = toPendingEmergencyCarePayload(firstEmergency);
  assert.deepEqual(
    payload,
    {
      id: firstEmergency.id,
      dogId: "dog-1",
      kennelIdAtEvent: "kennel-1",
      emergencyType: "ACCIDENT_ILLNESS",
      status: "PENDING",
      createdAtEpoch: 1_000,
      responseDeadlineEpoch: 1_048,
      treatmentCost: 3_000,
      survivalChanceBps: 9_500,
    },
    "pending emergency payload contains only later UI-facing event data"
  );

  await assert.rejects(
    () => assertDogHasNoPendingEmergencyCare("dog-1", fakeClient),
    /pending emergency vet-care event/,
    "action-lock helper rejects dogs with pending emergency care"
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
