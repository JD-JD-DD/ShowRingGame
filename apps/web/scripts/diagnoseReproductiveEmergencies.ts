import { PrismaClient } from "@prisma/client";
import { getCurrentEpoch } from "../lib/gameClock";

const db = new PrismaClient();

async function main() {
  const currentEpoch = getCurrentEpoch();
  const [pending, authorized, treated, untreated, expired, missingAttempt, treatedMissingLedger, resolvedMissingOutcome, survivorMissingLitter, zeroWithLitter] = await Promise.all([
    db.reproductiveEmergencyEvent.count({ where: { status: "PENDING" } }),
    db.reproductiveEmergencyEvent.count({ where: { status: "TREATMENT_AUTHORIZED" } }),
    db.reproductiveEmergencyEvent.count({ where: { status: "RESOLVED_TREATED" } }),
    db.reproductiveEmergencyEvent.count({ where: { status: "RESOLVED_UNTREATED" } }),
    db.reproductiveEmergencyEvent.count({ where: { status: "PENDING", responseDeadlineEpoch: { lt: currentEpoch } } }),
    Promise.resolve(0), // breedingAttemptId is a required foreign key; the database enforces this invariant.
    db.reproductiveEmergencyEvent.count({ where: { status: "TREATMENT_AUTHORIZED", ledgerTransactionId: null } }),
    db.reproductiveEmergencyEvent.count({ where: { status: { in: ["RESOLVED_TREATED", "RESOLVED_UNTREATED"] }, OR: [{ resolvedEpoch: null }, { damOutcome: null }, { puppyOutcome: null }, { survivingPuppyCount: null }] } }),
    db.reproductiveEmergencyEvent.count({ where: { survivingPuppyCount: { gt: 0 }, litterId: null } }),
    db.reproductiveEmergencyEvent.count({ where: { survivingPuppyCount: 0, litterId: { not: null } } }),
  ]);
  console.log(JSON.stringify({ currentEpoch, unresolved: pending + authorized, pending, treatmentAuthorized: authorized, resolvedTreated: treated, resolvedUntreated: untreated, expiredPending: expired, missingAttemptLink: missingAttempt, treatedMissingLedger, resolvedMissingOutcome, survivorMissingLitter, zeroSurvivorWithLitter: zeroWithLitter }, null, 2));
}

main().finally(() => db.$disconnect());
