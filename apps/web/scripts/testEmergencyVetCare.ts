import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type DogEmergencyCareEvent, type Prisma } from "@prisma/client";
import {
  calculateEmergencyVetCareDeadlineEpoch,
  createPendingEmergencyForAccidentIllnessDeath,
  EMERGENCY_VET_CARE_COST_TIERS,
  EMERGENCY_VET_CARE_RESPONSE_WINDOW_HOURS,
  getAccidentIllnessEmergencySourceKey,
  getEmergencyVetCareNoticeSourceKey,
  getEmergencyVetCareCostTierWeightTotalBps,
  selectEmergencyVetCareCostTier,
  selectEmergencyVetCareCostTierFromRollBps,
  selectTreatmentSurvivalOutcomeFromRollBps,
  toEmergencyCareActionResponsePayload,
  toPendingEmergencyCarePayload,
  assertDogHasNoPendingEmergencyCare,
  type EmergencyVetCareClient,
} from "../server/services/emergencyVetCare.service";

const root = join(__dirname, "../../..");

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
          events.find((event) => {
            if (where?.sourceKey && event.sourceKey !== where.sourceKey) {
              return false;
            }

            if (where?.dogId && event.dogId !== where.dogId) {
              return false;
            }

            if (typeof where?.status === "string") {
              return event.status === where.status;
            }

            if (
              typeof where?.status === "object" &&
              where.status !== null &&
              "not" in where.status &&
              event.status === where.status.not
            ) {
              return false;
            }

            return true;
          }) ?? null
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
          sourceKey: data.sourceKey ?? null,
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
const showEntryPlanner = source("apps/web/app/shows/[showId]/ShowEntryPlanner.tsx");
const showEntryRoute = source("apps/web/app/api/shows/[showId]/enter/route.ts");
const breedingService = source("apps/web/server/services/breeding.service.ts");
const marketService = source("apps/web/server/services/market.service.ts");
const foundationDogService = source(
  "apps/web/server/services/foundationDog.service.ts"
);
const groomingService = source("apps/web/server/services/grooming.service.ts");
const rehomeService = source("apps/web/server/services/rehome.service.ts");
const dogService = source("apps/web/server/services/dog.service.ts");
const dogMapper = source("apps/web/server/mappers/dog.mapper.ts");
const dogProfileDashboard = source(
  "apps/web/components/dogs/DogProfileDashboard.tsx"
);
const emergencyVetCarePanel = source(
  "apps/web/components/dogs/EmergencyVetCarePanel.tsx"
);
const emergencyCareLink = source("apps/web/components/EmergencyCareLink.tsx");
const appLayout = source("apps/web/app/layout.tsx");

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
  "toEmergencyCareActionResponsePayload(result)",
  "treatment route returns a safe emergency care response payload"
);
assertDoesNotInclude(
  treatRoute,
  "emergencyCareEvent: result.event",
  "treatment route does not return the raw Prisma emergency event"
);
assertDoesNotInclude(
  treatRoute,
  "outcomeSeed",
  "treatment route source does not expose outcome seed"
);
assertDoesNotInclude(
  treatRoute,
  "outcomeRollBps",
  "treatment route source does not expose outcome roll"
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
  "toEmergencyCareActionResponsePayload(result)",
  "decline route returns a safe emergency care response payload"
);
assertDoesNotInclude(
  declineRoute,
  "emergencyCareEvent: result.event",
  "decline route does not return the raw Prisma emergency event"
);
assertDoesNotInclude(
  declineRoute,
  "outcomeSeed",
  "decline route source does not expose outcome seed"
);
assertDoesNotInclude(
  declineRoute,
  "outcomeRollBps",
  "decline route source does not expose outcome roll"
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
  showEntryService,
  "hasPendingEmergencyCare: boolean",
  "show entry planner DTO exposes pending emergency status"
);
assertIncludes(
  showEntryService,
  "pendingEmergencyBlockReason: string | null",
  "show entry planner DTO exposes a safe emergency block reason"
);
assertIncludes(
  showEntryService,
  "getPendingEmergencyShowEntryMessage",
  "show entry service centralizes player-facing emergency entry messaging"
);
assertBefore(
  showEntryService,
  "const pendingEmergencyDogs = await db.dog.findMany",
  "const cluster = await tx.showCluster.findUnique",
  "bulk show entry prevalidates pending emergency dogs before the write transaction"
);
assertIncludes(
  showEntryService,
  "dogEmergencyCareEvent.findMany",
  "bulk show entry uses a single final emergency safety query in the transaction"
);
assertIncludes(
  showEntryPlanner,
  "Emergency vet care must be resolved before this dog can be entered.",
  "show entry UI explains emergency-blocked dogs"
);
assertIncludes(
  showEntryPlanner,
  "Emergency",
  "show entry UI displays an emergency marker"
);
assertIncludes(
  showEntryPlanner,
  "dog.hasPendingEmergencyCare",
  "show entry UI disables emergency-blocked selections"
);
assertIncludes(
  showEntryRoute,
  "getSafeEntryErrorMessage",
  "show entry route sanitizes unexpected errors"
);
assertIncludes(
  showEntryRoute,
  "We could not submit those entries. Please try again, or enter fewer dogs. If this continues, contact support.",
  "show entry route has the approved friendly fallback"
);
assertDoesNotInclude(
  showEntryRoute,
  'error instanceof Error ? error.message : "Failed to enter dog."',
  "show entry route does not redirect raw exception text"
);
assertIncludes(
  emergencyCareLink,
  'status: "PENDING"',
  "global emergency link only appears for pending emergency care"
);
assertIncludes(
  emergencyCareLink,
  "TODO: Link multiple pending emergencies to a dedicated emergency list page.",
  "global emergency link documents the multiple-emergency follow-up"
);
assertIncludes(
  appLayout,
  "<EmergencyCareLink />",
  "root layout renders the global emergency link"
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
assertIncludes(
  dogService,
  "emergencyCareEvents",
  "dog profile service selects pending emergency care data"
);
assertIncludes(
  dogService,
  'where: { status: "PENDING" }',
  "dog profile service limits emergency care data to pending events"
);
assertIncludes(
  dogService,
  "pendingEmergencyCare.survivalChanceBps",
  "dog profile service exposes survival chance for display"
);
assertDoesNotInclude(
  dogMapper,
  "outcomeSeed",
  "dog profile mapper does not expose emergency outcome seed"
);
assertDoesNotInclude(
  dogMapper,
  "outcomeRollBps",
  "dog profile mapper does not expose emergency outcome roll"
);
assertIncludes(
  dogMapper,
  "DogProfileEmergencyCareDto",
  "dog profile mapper has a scoped emergency care DTO"
);
assertIncludes(
  dogProfileDashboard,
  "EmergencyVetCarePanel",
  "dog dashboard renders the emergency vet-care panel"
);
assertIncludes(
  emergencyVetCarePanel,
  "Emergency Vet Care Required",
  "emergency panel uses the approved panel title"
);
assertIncludes(
  emergencyVetCarePanel,
  "/emergency-care/treat",
  "emergency panel calls the treatment route"
);
assertIncludes(
  emergencyVetCarePanel,
  "/emergency-care/decline",
  "emergency panel calls the decline route"
);
assertIncludes(
  emergencyVetCarePanel,
  "Declining care will result in",
  "emergency panel has an in-page decline confirmation"
);
assertIncludes(
  emergencyVetCarePanel,
  "router.refresh()",
  "emergency panel refreshes the dog page after resolution"
);
assertDoesNotInclude(
  emergencyVetCarePanel,
  "window.confirm",
  "emergency panel does not use browser confirmation"
);
assertDoesNotInclude(
  emergencyVetCarePanel,
  "outcomeSeed",
  "emergency panel does not expose outcome seed"
);
assertDoesNotInclude(
  emergencyVetCarePanel,
  "outcomeRollBps",
  "emergency panel does not expose outcome roll"
);
assertIncludes(
  lifecycleService,
  "Emergency vet care required",
  "lifecycle conversion creates an emergency notice"
);
assertIncludes(
  lifecycleService,
  "emergencyCareEventId",
  "emergency notices are deduped by event id metadata"
);
assertIncludes(
  emergencyVetCareService,
  "getAccidentIllnessEmergencySourceKey",
  "emergency service exposes deterministic accident/illness source keys"
);
assertIncludes(
  emergencyVetCareService,
  "sourceKey",
  "emergency service writes durable source keys"
);
assertIncludes(
  emergencyVetCareService,
  "isUniqueConstraintError",
  "emergency creation handles unique-key races by rereading"
);
assertBefore(
  emergencyVetCareService,
  "const update = await tx.dogEmergencyCareEvent.updateMany({",
  "const ledgerTransaction = await tx.ledgerTransaction.create({",
  "treatment claims the pending event before creating a ledger debit"
);
assertIncludes(
  emergencyVetCareService,
  "markRelatedEmergencyNoticeHandled",
  "treatment marks related emergency notices handled"
);
assertIncludes(
  lifecycleService,
  'dog.marketState === "LISTED_NPC"',
  "lifecycle skips accident/illness emergency creation for listed NPC dogs"
);
assertIncludes(
  lifecycleService,
  'emergencyCareEvent.status === "PENDING"',
  "lifecycle only creates notices for pending emergency events"
);
assertIncludes(
  lifecycleService,
  "getEmergencyVetCareNoticeSourceKey",
  "lifecycle uses durable source keys for emergency notices"
);
assertIncludes(
  foundationDogService,
  'canceledReason: "Canceled during foundation purchase; event originated while system-owned."',
  "foundation purchase cancels stale system-owned pending emergencies"
);

async function main(): Promise<void> {
  const events: DogEmergencyCareEvent[] = [];
  const fakeClient = createFakeEmergencyVetCareClient(events);
  const emergencySourceKey = getAccidentIllnessEmergencySourceKey({
    dogId: "dog-1",
    projectedDeathEpoch: 990,
  });
  const firstEmergency = await createPendingEmergencyForAccidentIllnessDeath({
    dogId: "dog-1",
    kennelIdAtEvent: "kennel-1",
    createdAtEpoch: 1_000,
    projectedDeathEpoch: 990,
    costRollBps: 0,
    outcomeSeed: "seed-1",
    client: fakeClient,
  });
  const secondEmergency = await createPendingEmergencyForAccidentIllnessDeath({
    dogId: "dog-1",
    kennelIdAtEvent: "kennel-1",
    createdAtEpoch: 1_100,
    projectedDeathEpoch: 990,
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
    firstEmergency.sourceKey,
    emergencySourceKey,
    "created emergency stores deterministic accident/illness source key"
  );
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

  firstEmergency.status = "TREATED_SURVIVED";
  firstEmergency.resolvedAtEpoch = 1_002;
  const resolvedReuse = await createPendingEmergencyForAccidentIllnessDeath({
    dogId: "dog-1",
    kennelIdAtEvent: "kennel-1",
    createdAtEpoch: 1_200,
    projectedDeathEpoch: 990,
    costRollBps: 9_999,
    outcomeSeed: "seed-3",
    client: fakeClient,
  });

  assert.equal(
    resolvedReuse.id,
    firstEmergency.id,
    "resolved accident/illness event is reused for the same source key"
  );
  assert.equal(
    events.length,
    1,
    "resolved accident/illness event does not regenerate after treatment"
  );
  assert.equal(
    getEmergencyVetCareNoticeSourceKey(firstEmergency.id),
    "EMERGENCY_VET_CARE:emergency-1",
    "emergency notice source key is stable by emergency event id"
  );

  const safeActionPayload = toEmergencyCareActionResponsePayload({
    event: {
      ...firstEmergency,
      status: "TREATED_DIED",
      paidAtEpoch: 1_002,
      resolvedAtEpoch: 1_002,
      treatmentOutcome: "DIED_DESPITE_TREATMENT",
      ledgerTransactionId: "ledger-secret",
      outcomeSeed: "seed-secret",
      outcomeRollBps: 9_500,
    },
    dogDied: true,
  });
  const serializedSafeActionPayload = JSON.stringify(safeActionPayload);

  assert.equal(
    safeActionPayload.emergencyCareEvent.status,
    "TREATED_DIED",
    "safe action payload includes resolved status"
  );
  assert.equal(
    safeActionPayload.emergencyCareEvent.treatmentOutcome,
    "DIED_DESPITE_TREATMENT",
    "safe action payload includes treatment outcome"
  );
  assert.equal(
    safeActionPayload.dogAlive,
    false,
    "safe action payload includes dog alive status"
  );
  assertDoesNotInclude(
    serializedSafeActionPayload,
    "seed-secret",
    "safe action payload omits outcome seed values"
  );
  assertDoesNotInclude(
    serializedSafeActionPayload,
    "outcomeSeed",
    "safe action payload omits outcome seed keys"
  );
  assertDoesNotInclude(
    serializedSafeActionPayload,
    "outcomeRollBps",
    "safe action payload omits outcome roll keys"
  );
  assertDoesNotInclude(
    serializedSafeActionPayload,
    "ledger-secret",
    "safe action payload omits ledger transaction ids"
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
