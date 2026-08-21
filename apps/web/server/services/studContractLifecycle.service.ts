import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { getProjectedDogDeath } from "@/server/services/lifecycle.service";
import { hasSelectableStudContractPuppy, reconcileSelectedStudContractPuppyDeath } from "@/server/services/studContractPuppySelection.service";
import { NEONATAL_PUPPY_DEATH_WINDOW_HOURS } from "@showring/rules";

const DEFAULT_BATCH_LIMIT = 50;
const PUPPY_SELECTION_TURN_MS = 24 * 60 * 60 * 1000;

export function evaluateStudContractLitterQualification(args: {
  compensationType: "CASH" | "PUPPY_BACK" | "CASH_AND_PUPPY_BACK";
  minimumLitterSize: number | null;
  smallLitterReturnThreshold: number | null;
  survivingPuppyCount: number;
}) {
  let puppyBackMinimumMet: boolean | null = null;
  if (args.compensationType !== "CASH") {
    if (args.minimumLitterSize === null) {
      throw new Error("Accepted Puppy Back StudContract is missing its minimum litter size.");
    }
    puppyBackMinimumMet = args.survivingPuppyCount >= args.minimumLitterSize;
  }
  return {
    puppyBackMinimumMet,
    smallLitterReturnServiceMet: args.smallLitterReturnThreshold === null
      ? null
      : args.survivingPuppyCount <= args.smallLitterReturnThreshold,
  };
}

export async function processStudContractLitterQualifications(args: {
  currentEpoch: number;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_BATCH_LIMIT, 100));
  const candidates = await db.studContract.findMany({
    where: { status: "ACCEPTED", litterId: { not: null }, qualificationCheckpointAt: null, litter: { bornEpoch: { lte: args.currentEpoch - NEONATAL_PUPPY_DEATH_WINDOW_HOURS } } },
    take: limit,
    orderBy: [{ litter: { bornEpoch: "asc" } }, { id: "asc" }],
    include: { litter: { select: { id: true, bornEpoch: true } } },
  });
  const puppies = await db.dog.findMany({
    where: { litterId: { in: candidates.flatMap((contract) => contract.litter?.id ?? []) } },
    select: { id: true, birthEpoch: true, deathEpoch: true, originType: true, litterId: true },
  });
  const checkpointEpochByLitterId = new Map<string, number>();
  for (const contract of candidates) {
    if (!contract.litter) continue;
    checkpointEpochByLitterId.set(
      contract.litter.id,
      contract.litter.bornEpoch + NEONATAL_PUPPY_DEATH_WINDOW_HOURS
    );
  }
  const survivorsByLitterId = new Map<string, number>();
  for (const puppy of puppies) {
    if (!puppy.litterId) continue;
    const checkpointEpoch = checkpointEpochByLitterId.get(puppy.litterId);
    if (checkpointEpoch === undefined) continue;
    if (getProjectedDogDeath(puppy).deathEpoch > checkpointEpoch) {
      survivorsByLitterId.set(puppy.litterId, (survivorsByLitterId.get(puppy.litterId) ?? 0) + 1);
    }
  }
  let qualifiedCount = 0;
  let failedCount = 0;
  for (const contract of candidates) {
    try {
      if (!contract.litter) continue;
      const survivors = survivorsByLitterId.get(contract.litter.id) ?? 0;
      const facts = evaluateStudContractLitterQualification({
        compensationType: contract.compensationType,
        minimumLitterSize: contract.minimumLitterSize,
        smallLitterReturnThreshold: contract.smallLitterReturnThreshold,
        survivingPuppyCount: survivors,
      });
      const update = await db.studContract.updateMany({
        where: { id: contract.id, status: "ACCEPTED", litterId: contract.litter.id, qualificationCheckpointAt: null },
        data: {
          qualificationCheckpointAt: epochToDate(contract.litter.bornEpoch + NEONATAL_PUPPY_DEATH_WINDOW_HOURS),
          qualifyingSurvivingPuppyCount: survivors,
          ...facts,
        },
      });
      qualifiedCount += update.count;
    } catch (error) {
      failedCount += 1;
      console.error("Stud Contract litter qualification failed", { contractId: contract.id, error });
    }
  }
  return { checkedCount: candidates.length, qualifiedCount, failedCount };
}

export async function openQualifiedStudContractPuppySelections(args?: {
  now?: Date;
  currentEpoch?: number;
  limit?: number;
}) {
  const now = args?.now ?? new Date();
  const currentEpoch = args?.currentEpoch ?? Math.floor(Date.now() / 1000);
  const limit = Math.max(1, Math.min(args?.limit ?? DEFAULT_BATCH_LIMIT, 100));
  const candidates = await db.studContract.findMany({
    where: {
      status: "ACCEPTED",
      compensationType: { in: ["PUPPY_BACK", "CASH_AND_PUPPY_BACK"] },
      litterId: { not: null },
      qualificationCheckpointAt: { not: null },
      puppyBackMinimumMet: true,
    },
    orderBy: [{ qualificationCheckpointAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      litterId: true,
      puppyPickPosition: true,
      sireKennelId: true,
      damKennelId: true,
      sireDogId: true,
      damDogId: true,
    },
  });
  let openedCount = 0;
  let failedCount = 0;
  for (const contract of candidates) {
    try {
      const litterId = contract.litterId;
      if (!litterId || !contract.puppyPickPosition) continue;
      const state = contract.puppyPickPosition === "FIRST" ? "STUD_PICK" : "DAM_FIRST_PICK";
      const currentActor = contract.puppyPickPosition === "FIRST" ? "STUD_OWNER" : "DAM_OWNER";
      const deadline = new Date(now.getTime() + PUPPY_SELECTION_TURN_MS);
      const opened = await db.$transaction(async (tx) => {
        const selection = await tx.studContractPuppySelection.upsert({
          where: { contractId: contract.id },
          create: { contractId: contract.id, litterId },
          update: {},
          select: { id: true },
        });
        const update = await tx.studContractPuppySelection.updateMany({
          where: { id: selection.id, status: "WAITING" },
          data: { status: state, currentActor, turnStartedAt: now, turnDeadlineAt: deadline },
        });
        if (update.count !== 1) return false;
        if (state === "STUD_PICK") {
          await createKennelNotice({
            client: tx,
            kennelId: contract.sireKennelId,
            sourceKey: `STUD_PUPPY_SELECTION_OPEN:${selection.id}:STUD_PICK`,
            type: "KENNEL_SERVICE",
            title: "Puppy Back selection is ready",
            body: "Your First Pick Puppy Back selection is ready. You have 24 real hours to choose; no puppy will be selected automatically.",
            currentEpoch,
            linkedDogId: contract.sireDogId,
            linkedLitterId: contract.litterId,
          });
        } else {
          await createKennelNotice({
            client: tx,
            kennelId: contract.damKennelId,
            sourceKey: `STUD_PUPPY_SELECTION_OPEN:${selection.id}:DAM_FIRST_PICK`,
            type: "KENNEL_SERVICE",
            title: "Protected first puppy selection is ready",
            body: "Your protected first selection is ready. You have 24 real hours to choose from the qualifying litter without the stud owner's sex restriction; no puppy will be selected automatically.",
            currentEpoch,
            linkedDogId: contract.damDogId,
            linkedLitterId: contract.litterId,
          });
          await createKennelNotice({
            client: tx,
            kennelId: contract.sireKennelId,
            sourceKey: `STUD_PUPPY_SELECTION_OPEN:${selection.id}:SECOND_PICK_INFO`,
            type: "KENNEL_SERVICE",
            title: "Second Pick Puppy Back workflow has begun",
            body: "The dam owner has the protected first selection. Your selection turn will begin after that pick is resolved or forfeited.",
            currentEpoch,
            linkedDogId: contract.sireDogId,
            linkedLitterId: contract.litterId,
          });
        }
        return true;
      });
      if (opened) openedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error("Stud Contract Puppy Back selection opening failed", { contractId: contract.id, error });
    }
  }
  return { checkedCount: candidates.length, openedCount, failedCount };
}

export async function processExpiredStudContractPuppySelectionTurns(args?: {
  now?: Date;
  currentEpoch?: number;
  limit?: number;
}) {
  const now = args?.now ?? new Date();
  const currentEpoch = args?.currentEpoch ?? Math.floor(Date.now() / 1000);
  const limit = Math.max(1, Math.min(args?.limit ?? DEFAULT_BATCH_LIMIT, 100));
  const candidates = await db.studContractPuppySelection.findMany({
    where: {
      status: { in: ["DAM_FIRST_PICK", "STUD_PICK"] },
      turnDeadlineAt: { not: null, lte: now },
    },
    orderBy: [{ turnDeadlineAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true },
  });
  let damForfeitedCount = 0;
  let studForfeitedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    try {
      const result = await db.$transaction(async (tx) => {
        const selection = await tx.studContractPuppySelection.findUnique({
          where: { id: candidate.id },
          select: {
            id: true,
            litterId: true,
            status: true,
            currentActor: true,
            turnDeadlineAt: true,
            damFirstPickDogId: true,
            selectedDogId: true,
            damFirstPickForfeitedAt: true,
            studSelectionForfeitedAt: true,
            contract: { select: { puppySex: true, sireKennelId: true, damKennelId: true, sireDogId: true, damDogId: true } },
          },
        });
        if (!selection || !selection.turnDeadlineAt || selection.turnDeadlineAt > now) return "skipped";

        if (selection.status === "DAM_FIRST_PICK" && selection.currentActor === "DAM_OWNER" && !selection.damFirstPickDogId && !selection.damFirstPickForfeitedAt) {
          const hasCandidate = await hasSelectableStudContractPuppy({
            client: tx,
            litterId: selection.litterId,
            damFirstPickDogId: null,
            puppySex: selection.contract.puppySex,
          });
          const studDeadline = new Date(now.getTime() + PUPPY_SELECTION_TURN_MS);
          const update = await tx.studContractPuppySelection.updateMany({
            where: { id: selection.id, status: "DAM_FIRST_PICK", currentActor: "DAM_OWNER", turnDeadlineAt: { lte: now }, damFirstPickDogId: null, damFirstPickForfeitedAt: null },
            data: hasCandidate
              ? { damFirstPickForfeitedAt: now, status: "STUD_PICK", currentActor: "STUD_OWNER", turnStartedAt: now, turnDeadlineAt: studDeadline }
              : { damFirstPickForfeitedAt: now, status: "UNFULFILLABLE", currentActor: "NONE", turnStartedAt: null, turnDeadlineAt: null, completedAt: now },
          });
          if (update.count !== 1) return "skipped";
          await createKennelNotice({ client: tx, kennelId: selection.contract.damKennelId, sourceKey: `STUD_PUPPY_SELECTION_DAM_FORFEITED:${selection.id}`, type: "KENNEL_SERVICE", title: "Protected first-pick right forfeited", body: "Your protected first-pick deadline passed. That selection right was forfeited. No puppy was selected.", currentEpoch, linkedDogId: selection.contract.damDogId, linkedLitterId: selection.litterId });
          if (hasCandidate) {
            await createKennelNotice({ client: tx, kennelId: selection.contract.sireKennelId, sourceKey: `STUD_PUPPY_SELECTION_DAM_FORFEITED_STUD_OPEN:${selection.id}`, type: "KENNEL_SERVICE", title: "Stud puppy selection is ready", body: "The dam owner's protected first-pick right was forfeited. Your Puppy Back selection is now open for 24 real hours.", currentEpoch, linkedDogId: selection.contract.sireDogId, linkedLitterId: selection.litterId });
          } else {
            await createKennelNotice({ client: tx, kennelId: selection.contract.sireKennelId, sourceKey: `STUD_PUPPY_SELECTION_DAM_FORFEITED_UNFULFILLABLE:${selection.id}`, type: "KENNEL_SERVICE", title: "Puppy Back cannot be fulfilled", body: "The dam owner's protected first-pick right was forfeited, and no living puppy satisfies the contract sex requirement. No puppy was selected.", currentEpoch, linkedDogId: selection.contract.sireDogId, linkedLitterId: selection.litterId });
          }
          return "damForfeited";
        }

        if (selection.status === "STUD_PICK" && selection.currentActor === "STUD_OWNER" && !selection.selectedDogId && !selection.studSelectionForfeitedAt) {
          const update = await tx.studContractPuppySelection.updateMany({
            where: { id: selection.id, status: "STUD_PICK", currentActor: "STUD_OWNER", turnDeadlineAt: { lte: now }, selectedDogId: null, studSelectionForfeitedAt: null },
            data: { studSelectionForfeitedAt: now, status: "FORFEITED", currentActor: "NONE", turnStartedAt: null, turnDeadlineAt: null, completedAt: now },
          });
          if (update.count !== 1) return "skipped";
          for (const kennelId of [selection.contract.sireKennelId, selection.contract.damKennelId]) {
            await createKennelNotice({ client: tx, kennelId, sourceKey: `STUD_PUPPY_SELECTION_STUD_FORFEITED:${selection.id}:${kennelId}`, type: "KENNEL_SERVICE", title: "Puppy Back selection right forfeited", body: "Puppy Back selection deadline missed. The stud owner's puppy-selection right was forfeited. No puppy was selected.", currentEpoch, linkedDogId: selection.contract.sireDogId, linkedLitterId: selection.litterId });
          }
          return "studForfeited";
        }
        return "skipped";
      });
      if (result === "damForfeited") damForfeitedCount += 1;
      else if (result === "studForfeited") studForfeitedCount += 1;
      else skippedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error("Stud Contract puppy selection deadline processing failed", { selectionId: candidate.id, error });
    }
  }
  return { checkedCount: candidates.length, damForfeitedCount, studForfeitedCount, skippedCount, failedCount };
}

export async function reconcileSelectedStudContractPuppyDeaths(args?: {
  currentEpoch?: number;
  now?: Date;
  limit?: number;
}) {
  const currentEpoch = args?.currentEpoch ?? Math.floor(Date.now() / 1000);
  const now = args?.now ?? new Date();
  const limit = Math.max(1, Math.min(args?.limit ?? DEFAULT_BATCH_LIMIT, 100));
  const candidates = await db.studContractPuppySelection.findMany({
    where: { status: "SELECTED", selectedDogId: { not: null }, selectedDog: { lifecycleState: "DECEASED" } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, selectedDogId: true },
  });
  let reopenedCount = 0;
  let unfulfillableCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  for (const candidate of candidates) {
    try {
      if (!candidate.selectedDogId) {
        skippedCount += 1;
        continue;
      }
      const result = await reconcileSelectedStudContractPuppyDeath({ client: db, dogId: candidate.selectedDogId, currentEpoch, now });
      if (result === "reopened") reopenedCount += 1;
      else if (result === "unfulfillable") unfulfillableCount += 1;
      else skippedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error("Stud Contract selected puppy death reconciliation failed", { selectionId: candidate.id, error });
    }
  }
  return { checkedCount: candidates.length, reopenedCount, unfulfillableCount, skippedCount, failedCount };
}

export async function processExpiredStudContractRequests(args?: {
  now?: Date;
  currentEpoch?: number;
  limit?: number;
}) {
  const now = args?.now ?? new Date();
  const currentEpoch = args?.currentEpoch ?? Math.floor(Date.now() / 1000);
  const limit = Math.max(1, Math.min(args?.limit ?? DEFAULT_BATCH_LIMIT, 100));
  const candidates = await db.studContract.findMany({
    where: { status: "PENDING", approvalDeadlineAt: { lte: now } },
    orderBy: [{ approvalDeadlineAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, damKennelId: true, damDogId: true, sireDogId: true },
  });
  let expiredCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  for (const candidate of candidates) {
    try {
      const transitioned = await db.$transaction(async (tx) => {
        const update = await tx.studContract.updateMany({
          where: {
            id: candidate.id,
            status: "PENDING",
            approvalDeadlineAt: { lte: now },
          },
          data: { status: "EXPIRED", expiredAt: now },
        });
        if (update.count !== 1) return false;
        await createKennelNotice({
          client: tx,
          kennelId: candidate.damKennelId,
          sourceKey: `STUD_MANUAL_EXPIRED:${candidate.id}`,
          type: "KENNEL_SERVICE",
          title: "Stud approval request expired",
          body: "The stud approval request expired before it was approved.",
          currentEpoch,
          linkedDogId: candidate.damDogId,
          metadataJson: { studContractId: candidate.id, sireDogId: candidate.sireDogId },
        });
        return true;
      });
      if (transitioned) expiredCount += 1;
      else skippedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error("Stud Contract expiry failed", { contractId: candidate.id, error });
    }
  }
  return { checkedCount: candidates.length, expiredCount, skippedCount, failedCount };
}
