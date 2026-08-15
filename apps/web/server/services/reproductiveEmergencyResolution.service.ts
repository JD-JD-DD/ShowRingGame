import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { toPersistedDogTraits } from "@/server/services/phenotypePersistence.service";
import { formatDogDisplayName } from "@/lib/dogNames";
import { buildPuppySexes, loadPedigreeForCoi, mapBreedingTraits } from "@/server/services/breeding.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import { infectPuppiesFromDamBrucellosis } from "@/server/services/infectiousDisease.service";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import {
  ensureLitterKennelRun,
} from "@/server/services/kennelRun.service";
import { createLitterWithCollisionRetry } from "@/server/services/litterPersistence.service";
import { createPuppyGeneticsRandom01ForLitter } from "@/server/services/puppyGenetics.service";
import { markDogDeceased } from "@/server/services/lifecycle.service";
import { calculatePedigreeCoi, resolveReproductiveEmergencyOutcome, resolveWhelp } from "@showring/rules";

export type ReproductiveEmergencyResolutionMode = "TREATED" | "UNTREATED";
export type ReproductiveEmergencyUntreatedReason = "PLAYER_DECLINED" | "RESPONSE_EXPIRED";

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

export async function resolveReproductiveEmergencyEvent(args: { eventId: string; currentEpoch: number; resolutionMode: ReproductiveEmergencyResolutionMode; untreatedReason?: ReproductiveEmergencyUntreatedReason }) {
  return db.$transaction(async (tx) => {
    const event = await tx.reproductiveEmergencyEvent.findUnique({ where: { id: args.eventId }, include: { breedingAttempt: { include: { sire: true, dam: true } }, dam: true } });
    if (!event) throw new Error("Reproductive emergency event not found.");
    const treated = args.resolutionMode === "TREATED";
    if (event.status === "RESOLVED_TREATED" || event.status === "RESOLVED_UNTREATED") return { eventId: event.id, alreadyResolved: true, litterId: event.litterId };
    if (event.breedingAttempt.status !== "REPRODUCTIVE_EMERGENCY") throw new Error("Breeding attempt is not awaiting reproductive emergency resolution.");
    if (treated) {
      if (event.status !== "TREATMENT_AUTHORIZED" || !event.ledgerTransactionId || !event.treatmentAuthorizedEpoch) throw new Error("Treated resolution requires authorized treatment and its payment linkage.");
    } else if (
      event.ledgerTransactionId ||
      event.treatmentAuthorizedEpoch ||
      (args.untreatedReason === "PLAYER_DECLINED" && event.status !== "TREATMENT_DECLINED") ||
      (args.untreatedReason === "RESPONSE_EXPIRED" && (event.status !== "PENDING" || args.currentEpoch <= event.responseDeadlineEpoch)) ||
      !args.untreatedReason
    ) {
      throw new Error("Untreated resolution requires a declined emergency or an expired unpaid pending emergency.");
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
      const resolved = resolveWhelp({ attempt: { ...attempt, attemptId: attempt.id, status: "PREGNANT", pregCheckEpoch: attempt.pregCheckEpoch ?? attempt.createdEpoch, dueEpoch: attempt.dueEpoch ?? args.currentEpoch, checkedEpoch: attempt.checkedEpoch ?? attempt.createdEpoch, isPregnant: true, whelpedEpoch: null, litterId: null, rngSeed: attempt.rngSeed ?? event.rngSeed }, currentEpoch: args.currentEpoch, litterId, pupCount: outcome.survivingPuppyCount, puppyDogIds: puppyIds, puppySexes: buildPuppySexes(`${event.rngSeed}:reproductive-emergency`, outcome.survivingPuppyCount), sireTraits: mapBreedingTraits(attempt.sire), damTraits: mapBreedingTraits(attempt.dam), sireGenotype: attempt.sire.genotype ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${attempt.id} sire ${attempt.sireId} is missing genotype.`); })(), sireGeneticsVersion: attempt.sire.geneticsVersion ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${attempt.id} sire ${attempt.sireId} is missing geneticsVersion.`); })(), damGenotype: attempt.dam.genotype ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${attempt.id} dam ${attempt.damId} is missing genotype.`); })(), damGeneticsVersion: attempt.dam.geneticsVersion ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${attempt.id} dam ${attempt.damId} is missing geneticsVersion.`); })(), coiPercent: coi.coiPercent, coiGenerationDepth: coi.generationDepth, allowSinglePuppy: true, random01: () => 0.5,
        puppyGeneticsRandom01: createPuppyGeneticsRandom01ForLitter({ breedingAttemptId: attempt.id, litterId, geneticsSeed: attempt.rngSeed ?? event.rngSeed, sire: { id: attempt.sireId, traits: mapBreedingTraits(attempt.sire), genotype: attempt.sire.genotype, geneticsVersion: attempt.sire.geneticsVersion }, dam: { id: attempt.damId, traits: mapBreedingTraits(attempt.dam), genotype: attempt.dam.genotype, geneticsVersion: attempt.dam.geneticsVersion }, coiPercent: coi.coiPercent }),
      });
      const persistedLitter = await createLitterWithCollisionRetry({
        client: tx,
        litter: { id: litterId, bredByKennelId: attempt.createdByKennelId, sireId: attempt.sireId, damId: attempt.damId, breedCode2: attempt.breedCode2, serial7: resolved.litter.serial7, bornEpoch: args.currentEpoch, pupCount: outcome.survivingPuppyCount },
        puppies: resolved.puppies,
      });
      const litterRun = attempt.createdByKennelId && persistedLitter.puppies.length > 0
        ? await ensureLitterKennelRun({ client: tx, kennelId: attempt.createdByKennelId, litterId, breedCode2: attempt.breedCode2, serial7: persistedLitter.serial7 })
        : null;
      await tx.dog.createMany({ data: persistedLitter.puppies.map((puppy) => ({ id: puppy.dogId, ownerKennelId: attempt.createdByKennelId, breederKennelId: attempt.createdByKennelId, kennelRunId: litterRun?.id ?? null, callName: null, registeredName: null, regNumber: puppy.regNumber, breedCode2: puppy.breedCode2, sex: puppy.sex, birthEpoch: puppy.birthEpoch, lifecycleState: "ALIVE", marketState: "NOT_FOR_SALE", originType: "PLAYER_BRED", isFoundation: false, sireId: puppy.sireId, damId: puppy.damId, litterId, litterOrder: puppy.litterOrder, coiPercent: coi.coiPercent, coiGenerationDepth: coi.generationDepth, genotype: puppy.genotype, geneticsVersion: puppy.geneticsVersion, ...toPersistedDogTraits(puppy.traits) })) });
      await ensurePhenotypeHealthTruthsForDogs(tx, puppyIds);
      await infectPuppiesFromDamBrucellosis(tx, { damId: attempt.damId, puppyDogIds: puppyIds, currentEpoch: args.currentEpoch, breedingAttemptId: attempt.id });
    }
    const terminalStatus = litterId ? "WHELPED" : "FAILED";
    await tx.breedingAttempt.update({ where: { id: event.breedingAttemptId }, data: { status: terminalStatus, whelpedEpoch: litterId ? args.currentEpoch : null, litterId } });
    const consequence = outcome.damOutcome === "DIED" ? "NONE" : outcome.reproductiveConsequence;
    const recoveryUntilEpoch = consequence === "EXTENDED_RECOVERY" ? args.currentEpoch + outcome.recoveryHours : null;
    await tx.reproductiveEmergencyEvent.update({ where: { id: event.id }, data: { litterId, survivingPuppyCount: outcome.survivingPuppyCount, damOutcome: outcome.damOutcome, puppyOutcome: outcome.puppyOutcome, reproductiveConsequence: consequence, recoveryUntilEpoch, damOutcomeRoll: outcome.rolls.damSurvivalRoll, puppyOutcomeRoll: outcome.rolls.puppyOutcomeRoll, reproductiveConsequenceRoll: outcome.rolls.reproductiveConsequenceRoll, outcomeMetadataJson: { ...outcome, resolutionMode: args.resolutionMode, untreatedReason: args.untreatedReason ?? null } } });
    if (outcome.damOutcome === "DIED") await markDogDeceased({ client: tx, dogId: event.dam.id, regNumber: event.dam.regNumber, ownerKennelId: event.dam.ownerKennelId, displayName: formatDogDisplayName(event.dam), deathEpoch: args.currentEpoch, cause: "WHELPING_DAM" });
    await createKennelNotice({ client: tx, kennelId: event.kennelIdAtEvent, sourceKey: getReproductiveEmergencyOutcomeNoticeSourceKey(event.id), type: "KENNEL_SERVICE", title: "Whelping emergency resolved", body: outcomeNotice({ name: formatDogDisplayName(event.dam), treated, intended: event.intendedPuppyCount, survived: outcome.survivingPuppyCount, damOutcome: outcome.damOutcome, consequence }), currentEpoch: args.currentEpoch, linkedDogId: event.damId, linkedLitterId: litterId, metadataJson: { reproductiveEmergencyEventId: event.id, resolutionMode: args.resolutionMode } });
    console.info("reproductive emergency resolved", { eventId: event.id, breedingAttemptId: event.breedingAttemptId, damId: event.damId, treated, intendedPuppyCount: event.intendedPuppyCount, survivingPuppyCount: outcome.survivingPuppyCount, damOutcome: outcome.damOutcome, puppyOutcome: outcome.puppyOutcome, reproductiveConsequence: consequence, litterId, resolvedEpoch: args.currentEpoch, rulesetVersion: event.rulesetVersion });
    return { eventId: event.id, litterId, alreadyResolved: false };
  });
}

export async function processExpiredReproductiveEmergencyEvents(args: { currentEpoch: number; limit?: number }) {
  const events = await db.reproductiveEmergencyEvent.findMany({ where: { OR: [{ status: "TREATMENT_DECLINED" }, { status: "PENDING", responseDeadlineEpoch: { lt: args.currentEpoch } }] }, orderBy: [{ responseDeadlineEpoch: "asc" }, { createdAt: "asc" }], take: Math.min(Math.max(args.limit ?? 100, 1), 500), select: { id: true, status: true } });
  let resolvedCount = 0;
  for (const event of events) { const result = await resolveReproductiveEmergencyEvent({ eventId: event.id, currentEpoch: args.currentEpoch, resolutionMode: "UNTREATED", untreatedReason: event.status === "TREATMENT_DECLINED" ? "PLAYER_DECLINED" : "RESPONSE_EXPIRED" }); if (!result.alreadyResolved) resolvedCount += 1; }
  return { processedCount: events.length, resolvedCount };
}

type AuthorizedReproductiveEmergencySelection = {
  id: string;
  breedingAttemptId: string;
  status: string;
  breedingAttempt: { status: string };
};

type TreatedResolutionTerminalState = {
  eventStatus: string;
  breedingAttemptStatus: string;
  litterId: string | null;
  resolvedEpoch: number | null;
};

type TreatedResolutionSuccess = TreatedResolutionTerminalState & {
  eventId: string;
  breedingAttemptId: string;
};

type TreatedResolutionFailure = {
  eventId: string;
  breedingAttemptId: string;
  eventStatus: string;
  breedingAttemptStatus: string;
  errorName: string;
  errorMessage: string;
  prismaCode: string | null;
  stack: string | null;
};

function getTreatedResolutionFailure(args: {
  event: AuthorizedReproductiveEmergencySelection;
  error: unknown;
}): TreatedResolutionFailure {
  const errorObject =
    typeof args.error === "object" && args.error !== null ? args.error : null;
  const errorName = args.error instanceof Error ? args.error.name : "UnknownError";
  const errorMessage =
    args.error instanceof Error ? args.error.message : String(args.error);
  const prismaCode =
    errorObject && "code" in errorObject && typeof errorObject.code === "string"
      ? errorObject.code
      : null;
  const stack =
    args.error instanceof Error && args.error.stack
      ? args.error.stack.split("\n").slice(0, 4).join("\n")
      : null;

  return {
    eventId: args.event.id,
    breedingAttemptId: args.event.breedingAttemptId,
    eventStatus: args.event.status,
    breedingAttemptStatus: args.event.breedingAttempt.status,
    errorName,
    errorMessage,
    prismaCode,
    stack,
  };
}

export async function processSelectedAuthorizedReproductiveEmergencyEvents(args: {
  events: AuthorizedReproductiveEmergencySelection[];
  resolveEvent: (eventId: string) => Promise<void>;
  getTerminalState: (eventId: string) => Promise<TreatedResolutionTerminalState | null>;
}) {
  const resolvedEventIds: string[] = [];
  const resolvedEvents: TreatedResolutionSuccess[] = [];
  const failedEvents: TreatedResolutionFailure[] = [];

  for (const event of args.events) {
    try {
      await args.resolveEvent(event.id);
      const terminal = await args.getTerminalState(event.id);
      if (!terminal) throw new Error("Resolved reproductive emergency event could not be reloaded.");

      const success = {
        eventId: event.id,
        breedingAttemptId: event.breedingAttemptId,
        eventStatus: terminal.eventStatus,
        breedingAttemptStatus: terminal.breedingAttemptStatus,
        litterId: terminal.litterId,
        resolvedEpoch: terminal.resolvedEpoch,
      };
      resolvedEventIds.push(event.id);
      resolvedEvents.push(success);
      console.info("[reproductive-emergency-resolution-succeeded]", success);
    } catch (error) {
      const failure = getTreatedResolutionFailure({ event, error });
      failedEvents.push(failure);
      console.error("[reproductive-emergency-resolution-failed]", failure);
    }
  }

  return {
    processedCount: args.events.length,
    selectedCount: args.events.length,
    resolvedCount: resolvedEventIds.length,
    failedCount: failedEvents.length,
    resolvedEventIds,
    resolvedEvents,
    failedEvents,
  };
}

export async function processAuthorizedReproductiveEmergencyEvents(args: { currentEpoch: number; limit?: number }) {
  const events = await db.reproductiveEmergencyEvent.findMany({ where: { status: "TREATMENT_AUTHORIZED" }, orderBy: [{ treatmentAuthorizedEpoch: "asc" }, { createdAt: "asc" }], take: Math.min(Math.max(args.limit ?? 100, 1), 500), select: { id: true, breedingAttemptId: true, status: true, breedingAttempt: { select: { status: true } } } });

  return processSelectedAuthorizedReproductiveEmergencyEvents({
    events,
    resolveEvent: async (eventId) => {
      await resolveReproductiveEmergencyEvent({
        eventId,
        currentEpoch: args.currentEpoch,
        resolutionMode: "TREATED",
      });
    },
    getTerminalState: async (eventId) => {
      const event = await db.reproductiveEmergencyEvent.findUnique({
        where: { id: eventId },
        select: {
          status: true,
          litterId: true,
          resolvedEpoch: true,
          breedingAttempt: { select: { status: true } },
        },
      });
      return event
        ? {
            eventStatus: event.status,
            breedingAttemptStatus: event.breedingAttempt.status,
            litterId: event.litterId,
            resolvedEpoch: event.resolvedEpoch,
          }
        : null;
    },
  });
}
