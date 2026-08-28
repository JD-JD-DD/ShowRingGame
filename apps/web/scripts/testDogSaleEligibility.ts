import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getDogSaleEligibility } from "../server/services/market.service";

type Scenario = {
  ownerKennelId?: string | null;
  lifecycleState?: "ALIVE" | "DECEASED" | "RETIRED" | "TRANSFERRED";
  birthEpoch?: number;
  marketState?: "NOT_FOR_SALE" | "LISTED_PLAYER";
  pendingCare?: boolean;
  activeListing?: boolean;
  breedingStatus?: "INITIATED" | "PREGNANT" | "REPRODUCTIVE_EMERGENCY" | null;
  protectedSelection?: "ACTIVE_SELECTION" | "SELECTED_CLAIM" | null;
};

function createClient(scenario: Scenario = {}) {
  const dog = {
    id: "dog-1",
    litterId: scenario.protectedSelection ? "litter-1" : null,
    sex: "F",
    ownerKennelId: scenario.ownerKennelId ?? "kennel-1",
    birthEpoch: scenario.birthEpoch ?? 44,
    lifecycleState: scenario.lifecycleState ?? "ALIVE",
    marketState: scenario.marketState ?? "NOT_FOR_SALE",
  };

  return {
    dog: {
      async findUnique() {
        return dog;
      },
    },
    dogEmergencyCareEvent: {
      async findFirst() {
        return scenario.pendingCare ? { id: "care-1" } : null;
      },
    },
    reproductiveEmergencyEvent: {
      async findFirst() {
        return null;
      },
    },
    studContractPuppySelection: {
      async findMany() {
        if (!scenario.protectedSelection) return [];
        return [{
          id: "selection-1",
          status:
            scenario.protectedSelection === "SELECTED_CLAIM"
              ? "SELECTED"
              : "DAM_FIRST_PICK",
          damFirstPickDogId: null,
          selectedDogId:
            scenario.protectedSelection === "SELECTED_CLAIM" ? dog.id : null,
          contract: { id: "contract-1", puppyPickPosition: "FIRST", puppySex: "EITHER" },
        }];
      },
    },
    breedingAttempt: {
      async findFirst() {
        return scenario.breedingStatus ? { id: "attempt-1" } : null;
      },
    },
    dogListing: {
      async findFirst() {
        return scenario.activeListing ? { id: "listing-1" } : null;
      },
    },
  };
}

async function eligibility(scenario: Scenario = {}, currentEpoch = 100) {
  return getDogSaleEligibility({
    dogId: "dog-1",
    sellerKennelId: "kennel-1",
    currentEpoch,
    client: createClient(scenario) as never,
  });
}

async function main() {
  assert.deepEqual(await eligibility(), {
    dogId: "dog-1", eligible: true, reasonCode: null, reasonMessage: null,
  });
  assert.equal((await eligibility({ birthEpoch: 45 })).reasonCode, "UNDER_SALE_AGE");
  assert.equal((await eligibility({ birthEpoch: 44 })).eligible, true, "56 hours remains eligible");
  assert.equal((await eligibility({ ownerKennelId: "kennel-2" })).reasonCode, "NOT_OWNED");
  assert.equal((await eligibility({ lifecycleState: "DECEASED" })).reasonCode, "NOT_ACTIVE");
  assert.equal((await eligibility({ activeListing: true })).reasonCode, "ALREADY_LISTED");
  assert.equal((await eligibility({ pendingCare: true })).reasonCode, "PENDING_VET_CARE");
  assert.equal((await eligibility({ protectedSelection: "ACTIVE_SELECTION" })).reasonCode, "STUD_CONTRACT_SELECTION_PROTECTED");

  for (const breedingStatus of ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] as const) {
    assert.equal(
      (await eligibility({ breedingStatus })).reasonCode,
      "BREEDING_CONFLICT",
      `${breedingStatus} dams cannot be listed`
    );
  }

  // Sale eligibility intentionally does not query show entries or isBreedingActive.
  assert.equal((await eligibility()).eligible, true, "show and breeding-active state are not sale guards");

  const source = readFileSync(
    resolve(__dirname, "..", "..", "..", "apps", "web", "server", "services", "market.service.ts"),
    "utf8"
  );
  assert.match(source, /getDogSaleEligibility\(\{[\s\S]*client: tx,/);
  assert.match(source, /dogListing\.create\(/);
  assert.match(source, /marketState: "LISTED_PLAYER"/);
  assert.match(source, /canSellPuppy\(args\.currentEpoch, dog\.birthEpoch, dog\.lifecycleState\)/);
  console.log("Dog sale eligibility checks passed.");
}

void main();
