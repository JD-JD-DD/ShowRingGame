import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { buildPuppySexes, loadPedigreeForCoi, mapBreedingTraits } from "@/server/services/breeding.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import { infectPuppiesFromDamBrucellosis } from "@/server/services/infectiousDisease.service";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { ensureUncategorizedKennelRun } from "@/server/services/kennelRun.service";
import { markDogDeceased } from "@/server/services/lifecycle.service";
import { calculatePedigreeCoi, resolveReproductiveEmergencyOutcome, resolveWhelp } from "@showring/rules";

export type ReproductiveEmergencyResolutionMode = "TREATED" | "UNTREATED_EXPIRED";

export function getReproductiveEmergencyOutcomeNoticeSourceKey(eventId: string) {
  return `REPRODUCTIVE_EMERGENCY_OUTCOME:${eventId}`;
}

function outcomeNotice(args: { name: string; treated: boolean; intended: number; survived: number; damOutcome: "SURVIVED" | "DIED"; consequence: "NONE" | "EXTENDED_RECOVERY" | "PERMANENT_BREEDING_RESTRICTION" }) {
  const care = args.treated ? "Emergency treatment was authorized." : "The treatment deadline passed before emergency care was authorized.";
  const pups = args.survived === args.intended ? `All ${args.intended} puppies survived.` : args.survived === 0 ? `None of the ${args.intended} puppies survived.` : `${args.survived} of ${args.intended} puppies survived.`;
  if (args.damOutcome === "DIED") return `${care} ${args.name} died from the whelping complication. ${pups}`;
  const consequence = args.consequence === "EXTENDED_RECOVERY" ? " She requires an extended recovery and cannot be bred for 365 hours from the emergency resolution." : args.consequence === "PERMANENT_BREEDING_RESTRICTION" ? " Veterinary complications mean she cannot safely carry another litter and may not be bred again." : " She has no lasting reproductive restriction and will use the normal 270-hour post-whelp recovery period.";
  return `${care} ${args.name} survived the whelping emergency. ${pups}${consequence}`;
}

export async function resolveReproductiveEmergencyEvent(args: { eventId: string; currentEpoch: number; resolutionMode: ReproductiveEmergencyResolutionMode }) {
  return db.$transaction(async (tx) => {
    const event = await tx.reproductiveEmergencyEvent.findUnique({ where: { id: args.eventId }, include: { breedingAttempt: { include: { sire: true, dam: true } }, dam: true } });
    if (!event) throw new Error("Reproductive emergency event not found.");
    const treated = args.resolutionMode === "TREATED";
    if (event.status === "RESOLVED_TREATED" || event.status === "RESOLVED_UNTREATED") return { eventId: event.id, alreadyResolved: true, litterId: event.litterId };
    if (event.breedingAttempt.status !== "REPRODUCTIVE_EMERGENCY") throw new Error("Breeding attempt is not awaiting reproductive emergency resolution.");
    if (treated) {
      if (event.status !== "TREATMENT_AUTHORIZED" || !event.ledgerTransactionId || !event.treatmentAuthorizedEpoch) throw new Error("Treated resolution requires authorized treatment and its payment linkage.");
    } else if (event.status !== "PENDING" || event.ledgerTransactionId || event.treatmentAuthorizedEpoch || args.currentEpoch <= event.responseDeadlineEpoch) {
      throw new Error("Untreated resolution requires an expired unpaid pending emergency.");
    }
    const lock = await tx.reproductiveEmergencyEvent.updateMany({ where: { id: event.id, status: event.status }, data: { status: treated ? "RESOLVED_TREATED" : "RESOLVED_UNTREATED", resolvedEpoch: args.currentEpoch } });
    if (lock.count !== 1) throw new Error("Reproductive emergency is being resolved by another request.");
    const outcome = resolveReproductiveEmergencyOutcome({ rngSeed: event.rngSeed, treatmentAuthorized: treated, intendedPuppyCount: event.intendedPuppyCount, rulesetVersion: event.rulesetVersion });
    let litterId: string | null = null;
    if (outcome.survivingPuppyCount > 0) {
      const attempt = event.breedingAttempt;
      const pedigree = await loadPedigreeForCoi(tx, [attempt.sireId, attempt.damId]);
      const coi = calculatePedigreeCoi({ sireId: attempt.sireId, damId: attempt.damId, pedigree });
      litterId = randomUUID();
      const puppyIds = Array.from({ length: outcome.survivingPuppyCount }, () => randomUUID());
      const resolved = resolveWhelp({ attempt: { ...attempt, attemptId: attempt.id, status: "PREGNANT", pregCheckEpoch: attempt.pregCheckEpoch ?? attempt.createdEpoch, dueEpoch: attempt.dueEpoch ?? args.currentEpoch, checkedEpoch: attempt.checkedEpoch ?? attempt.createdEpoch, isPregnant: true, whelpedEpoch: null, litterId: null, rngSeed: attempt.rngSeed ?? event.rngSeed }, currentEpoch: args.currentEpoch, litterId, pupCount: outcome.survivingPuppyCount, puppyDogIds: puppyIds, puppySexes: buildPuppySexes(`${event.rngSeed}:reproductive-emergency`, outcome.survivingPuppyCount), sireTraits: mapBreedingTraits(attempt.sire), damTraits: mapBreedingTraits(attempt.dam), coiPercent: coi.coiPercent, coiGenerationDepth: coi.generationDepth, random01: () => 0.5 });
      await tx.litter.create({ data: { id: litterId, bredByKennelId: attempt.createdByKennelId, sireId: attempt.sireId, damId: attempt.damId, breedCode2: attempt.breedCode2, serial7: resolved.litter.serial7, bornEpoch: args.currentEpoch, pupCount: outcome.survivingPuppyCount } });
      const kennelRunId = attempt.createdByKennelId ? attempt.dam.kennelRunId ?? (await ensureUncategorizedKennelRun({ kennelId: attempt.createdByKennelId, client: tx })).id : null;
      await tx.dog.createMany({ data: resolved.puppies.map((puppy) => ({ id: puppy.dogId, ownerKennelId: attempt.createdByKennelId, breederKennelId: attempt.createdByKennelId, kennelRunId, callName: null, registeredName: null, regNumber: puppy.regNumber, breedCode2: puppy.breedCode2, sex: puppy.sex, birthEpoch: puppy.birthEpoch, lifecycleState: "ALIVE", marketState: "NOT_FOR_SALE", originType: "PLAYER_BRED", isFoundation: false, sireId: puppy.sireId, damId: puppy.damId, litterId, litterOrder: puppy.litterOrder, coiPercent: coi.coiPercent, coiGenerationDepth: coi.generationDepth, traitHead: puppy.traits.head, traitForequarters: puppy.traits.forequarters, traitHindquarters: puppy.traits.hindquarters, traitGait: puppy.traits.gait, traitCoat: puppy.traits.coat, traitSize: puppy.traits.size, traitTemperament: puppy.traits.temperament, traitShowShine: puppy.traits.show_shine, traitFeet: puppy.traits.feet, traitTopline: puppy.traits.topline })) });
      await ensurePhenotypeHealthTruthsForDogs(tx, puppyIds);
      await infectPuppiesFromDamBrucellosis(tx, { damId: attempt.damId, puppyDogIds: puppyIds, currentEpoch: args.currentEpoch, breedingAttemptId: attempt.id });
    }
    const terminalStatus = litterId ? "WHELPED" : "FAILED";
    await tx.breedingAttempt.update({ where: { id: event.breedingAttemptId }, data: { status: terminalStatus, whelpedEpoch: litterId ? args.currentEpoch : null, litterId } });
    const consequence = outcome.damOutcome === "DIED" ? "NONE" : outcome.reproductiveConsequence;
    const recoveryUntilEpoch = consequence === "EXTENDED_RECOVERY" ? args.currentEpoch + outcome.recoveryHours : null;
    await tx.reproductiveEmergencyEvent.update({ where: { id: event.id }, data: { litterId, survivingPuppyCount: outcome.survivingPuppyCount, damOutcome: outcome.damOutcome, puppyOutcome: outcome.puppyOutcome, reproductiveConsequence: consequence, recoveryUntilEpoch, damOutcomeRoll: outcome.rolls.damSurvivalRoll, puppyOutcomeRoll: outcome.rolls.puppyOutcomeRoll, reproductiveConsequenceRoll: outcome.rolls.reproductiveConsequenceRoll, outcomeMetadataJson: { ...outcome, resolutionMode: args.resolutionMode } } });
    if (outcome.damOutcome === "DIED") await markDogDeceased({ client: tx, dogId: event.dam.id, regNumber: event.dam.regNumber, ownerKennelId: event.dam.ownerKennelId, displayName: formatDogDisplayName(event.dam), deathEpoch: args.currentEpoch, cause: "WHELPING_DAM" });
    await createKennelNotice({ client: tx, kennelId: event.kennelIdAtEvent, sourceKey: getReproductiveEmergencyOutcomeNoticeSourceKey(event.id), type: "KENNEL_SERVICE", title: "Whelping emergency resolved", body: outcomeNotice({ name: formatDogDisplayName(event.dam), treated, intended: event.intendedPuppyCount, survived: outcome.survivingPuppyCount, damOutcome: outcome.damOutcome, consequence }), currentEpoch: args.currentEpoch, linkedDogId: event.damId, linkedLitterId: litterId, metadataJson: { reproductiveEmergencyEventId: event.id, resolutionMode: args.resolutionMode } });
    console.info("reproductive emergency resolved", { eventId: event.id, breedingAttemptId: event.breedingAttemptId, damId: event.damId, treated, intendedPuppyCount: event.intendedPuppyCount, survivingPuppyCount: outcome.survivingPuppyCount, damOutcome: outcome.damOutcome, puppyOutcome: outcome.puppyOutcome, reproductiveConsequence: consequence, litterId, resolvedEpoch: args.currentEpoch, rulesetVersion: event.rulesetVersion });
    return { eventId: event.id, litterId, alreadyResolved: false };
  });
}

export async function processExpiredReproductiveEmergencyEvents(args: { currentEpoch: number; limit?: number }) {
  const events = await db.reproductiveEmergencyEvent.findMany({ where: { status: "PENDING", responseDeadlineEpoch: { lt: args.currentEpoch } }, orderBy: [{ responseDeadlineEpoch: "asc" }, { createdAt: "asc" }], take: Math.min(Math.max(args.limit ?? 100, 1), 500), select: { id: true } });
  let resolvedCount = 0;
  for (const event of events) { const result = await resolveReproductiveEmergencyEvent({ eventId: event.id, currentEpoch: args.currentEpoch, resolutionMode: "UNTREATED_EXPIRED" }); if (!result.alreadyResolved) resolvedCount += 1; }
  return { processedCount: events.length, resolvedCount };
}

export async function processAuthorizedReproductiveEmergencyEvents(args: { currentEpoch: number; limit?: number }) {
  const events = await db.reproductiveEmergencyEvent.findMany({ where: { status: "TREATMENT_AUTHORIZED" }, orderBy: [{ treatmentAuthorizedEpoch: "asc" }, { createdAt: "asc" }], take: Math.min(Math.max(args.limit ?? 100, 1), 500), select: { id: true } });
  let resolvedCount = 0;
  for (const event of events) { const result = await resolveReproductiveEmergencyEvent({ eventId: event.id, currentEpoch: args.currentEpoch, resolutionMode: "TREATED" }); if (!result.alreadyResolved) resolvedCount += 1; }
  return { processedCount: events.length, resolvedCount };
}
