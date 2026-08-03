import assert from "node:assert/strict";

import { processSelectedAuthorizedReproductiveEmergencyEvents } from "../server/services/reproductiveEmergencyResolution.service";

type EventState = {
  status: "TREATMENT_AUTHORIZED" | "RESOLVED_TREATED";
  breedingAttemptStatus: "REPRODUCTIVE_EMERGENCY" | "WHELPED";
  resolvedEpoch: number | null;
  litterId: string | null;
  ledgerTransactionId: string;
  treatmentCharges: number;
};

const states: Record<string, EventState> = {
  first: {
    status: "TREATMENT_AUTHORIZED",
    breedingAttemptStatus: "REPRODUCTIVE_EMERGENCY",
    resolvedEpoch: null,
    litterId: null,
    ledgerTransactionId: "ledger-first",
    treatmentCharges: 1,
  },
  second: {
    status: "TREATMENT_AUTHORIZED",
    breedingAttemptStatus: "REPRODUCTIVE_EMERGENCY",
    resolvedEpoch: null,
    litterId: null,
    ledgerTransactionId: "ledger-second",
    treatmentCharges: 1,
  },
};

let firstShouldFail = true;
const successfulResolutionCounts: Record<string, number> = { first: 0, second: 0 };
const resolveEvent = async (eventId: string) => {
  if (eventId === "first" && firstShouldFail) {
    const error = new Error("simulated resolver failure");
    Object.assign(error, { code: "P2002" });
    throw error;
  }
  const state = states[eventId];
  successfulResolutionCounts[eventId] += 1;
  state.status = "RESOLVED_TREATED";
  state.breedingAttemptStatus = "WHELPED";
  state.resolvedEpoch = 6000;
  state.litterId = `litter-${eventId}`;
};
const getTerminalState = async (eventId: string) => {
  const state = states[eventId];
  return {
    eventStatus: state.status,
    breedingAttemptStatus: state.breedingAttemptStatus,
    resolvedEpoch: state.resolvedEpoch,
    litterId: state.litterId,
  };
};

const selected = [
  { id: "first", breedingAttemptId: "attempt-first", status: "TREATMENT_AUTHORIZED" as const, breedingAttempt: { status: "REPRODUCTIVE_EMERGENCY" } },
  { id: "second", breedingAttemptId: "attempt-second", status: "TREATMENT_AUTHORIZED" as const, breedingAttempt: { status: "REPRODUCTIVE_EMERGENCY" } },
];

async function main() {
  const firstPass = await processSelectedAuthorizedReproductiveEmergencyEvents({
    events: selected,
    resolveEvent,
    getTerminalState,
  });

  assert.deepEqual(firstPass.resolvedEventIds, ["second"]);
  assert.equal(firstPass.selectedCount, 2);
  assert.equal(firstPass.resolvedCount, 1);
  assert.equal(firstPass.failedCount, 1);
  assert.deepEqual(firstPass.resolvedEvents, [{
    eventId: "second",
    breedingAttemptId: "attempt-second",
    eventStatus: "RESOLVED_TREATED",
    breedingAttemptStatus: "WHELPED",
    litterId: "litter-second",
    resolvedEpoch: 6000,
  }]);
  assert.equal(firstPass.failedEvents[0]?.eventId, "first");
  assert.equal(firstPass.failedEvents[0]?.breedingAttemptId, "attempt-first");
  assert.equal(firstPass.failedEvents[0]?.prismaCode, "P2002");
  assert.equal(states.first.status, "TREATMENT_AUTHORIZED");
  assert.equal(states.first.resolvedEpoch, null);
  assert.equal(states.first.ledgerTransactionId, "ledger-first");
  assert.equal(states.first.treatmentCharges, 1);
  assert.equal(states.second.status, "RESOLVED_TREATED");
  assert.equal(successfulResolutionCounts.second, 1);

  firstShouldFail = false;
  const retry = await processSelectedAuthorizedReproductiveEmergencyEvents({
    events: [selected[0]],
    resolveEvent,
    getTerminalState,
  });

  assert.equal(retry.resolvedCount, 1);
  assert.equal(retry.failedCount, 0);
  assert.equal(states.first.status, "RESOLVED_TREATED");
  assert.equal(states.first.treatmentCharges, 1);
  assert.equal(successfulResolutionCounts.first, 1);
  console.log("Treated reproductive-emergency batch isolation and retry checks passed.");
}

void main();
