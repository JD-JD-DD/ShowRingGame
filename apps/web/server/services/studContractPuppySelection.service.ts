import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { PUPPY_SALE_MIN_AGE_HOURS } from "@showring/rules";
import type { Prisma, PrismaClient } from "@prisma/client";

const PUPPY_SELECTION_TURN_MS = 24 * 60 * 60 * 1000;

export async function createStudContractPuppySelection(args: {
  contractId: string;
  litterId: string;
}) {
  return db.$transaction(async (tx) => {
    const contract = await tx.studContract.findUnique({
      where: { id: args.contractId },
      select: {
        status: true,
        compensationType: true,
        litterId: true,
        qualificationCheckpointAt: true,
      },
    });
    if (!contract || contract.status !== "ACCEPTED") {
      throw new Error("StudContract must be accepted before creating Puppy Back selection persistence.");
    }
    if (contract.compensationType === "CASH") {
      throw new Error("Cash-only StudContracts do not have Puppy Back selection persistence.");
    }
    if (contract.litterId !== args.litterId || contract.qualificationCheckpointAt === null) {
      throw new Error("Puppy Back selection persistence must use the qualified StudContract litter.");
    }
    return tx.studContractPuppySelection.create({
      data: { contractId: args.contractId, litterId: args.litterId },
    });
  });
}

async function loadSelectablePuppy(args: { client: Prisma.TransactionClient; litterId: string; puppyId: string }) {
  const puppy = await args.client.dog.findFirst({
    where: { id: args.puppyId, litterId: args.litterId, lifecycleState: "ALIVE" },
    select: { id: true, sex: true },
  });
  if (!puppy) throw new Error("That puppy is no longer available for selection.");
  return puppy;
}

export async function hasSelectableStudContractPuppy(args: {
  client: Pick<PrismaClient, "dog">;
  litterId: string;
  damFirstPickDogId: string | null;
  puppySex: "MALE" | "FEMALE" | "EITHER" | null;
}) {
  const puppy = await args.client.dog.findFirst({
    where: {
      litterId: args.litterId,
      lifecycleState: "ALIVE",
      ...(args.damFirstPickDogId ? { id: { not: args.damFirstPickDogId } } : {}),
      ...(args.puppySex === "MALE" ? { sex: "M" } : args.puppySex === "FEMALE" ? { sex: "F" } : {}),
    },
    select: { id: true },
  });
  return puppy !== null;
}

export async function reconcileSelectedStudContractPuppyDeath(args: {
  client: typeof db | Prisma.TransactionClient;
  dogId: string;
  currentEpoch: number;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const selection = await args.client.studContractPuppySelection.findFirst({
    where: { status: "SELECTED", selectedDogId: args.dogId },
    select: {
      id: true,
      litterId: true,
      selectedDogId: true,
      damFirstPickDogId: true,
      contract: { select: { puppySex: true, sireKennelId: true, damKennelId: true, sireDogId: true, damDogId: true } },
      selectedDog: { select: { birthEpoch: true, lifecycleState: true } },
    },
  });
  if (!selection || !selection.selectedDogId || selection.selectedDog?.lifecycleState !== "DECEASED") return "skipped";

  const windowClosesAtEpoch = selection.selectedDog.birthEpoch + PUPPY_SALE_MIN_AGE_HOURS;
  const windowOpen = args.currentEpoch < windowClosesAtEpoch;
  const hasReplacement = windowOpen && await hasSelectableStudContractPuppy({
    client: args.client,
    litterId: selection.litterId,
    damFirstPickDogId: selection.damFirstPickDogId,
    puppySex: selection.contract.puppySex,
  });
  const deadline = new Date(Math.min(now.getTime() + PUPPY_SELECTION_TURN_MS, epochToDate(windowClosesAtEpoch).getTime()));
  const update = await args.client.studContractPuppySelection.updateMany({
    where: { id: selection.id, status: "SELECTED", selectedDogId: args.dogId },
    data: hasReplacement
      ? { selectedDogId: null, status: "STUD_PICK", currentActor: "STUD_OWNER", turnStartedAt: now, turnDeadlineAt: deadline, completedAt: null }
      : { status: "UNFULFILLABLE", currentActor: "NONE", turnStartedAt: null, turnDeadlineAt: null, completedAt: now },
  });
  if (update.count !== 1) return "skipped";

  if (hasReplacement) {
    await createKennelNotice({ client: args.client, kennelId: selection.contract.sireKennelId, sourceKey: `STUD_PUPPY_SELECTION_REOPENED:${selection.id}:${args.dogId}`, type: "KENNEL_SERVICE", title: "Puppy Back selection reopened", body: `The puppy selected under the Stud Contract has died. Your Puppy Back selection has reopened with the same sex requirement. The new selection deadline is ${deadline.toLocaleString()}. The game will not select a puppy automatically.`, currentEpoch: args.currentEpoch, linkedDogId: selection.contract.sireDogId, linkedLitterId: selection.litterId });
    await createKennelNotice({ client: args.client, kennelId: selection.contract.damKennelId, sourceKey: `STUD_PUPPY_SELECTION_REOPENED_DAM_INFO:${selection.id}:${args.dogId}`, type: "KENNEL_SERVICE", title: "Puppy Back selection reopened", body: "The selected contract puppy died. The stud owner's replacement-selection turn has reopened under the existing contract terms.", currentEpoch: args.currentEpoch, linkedDogId: selection.contract.damDogId, linkedLitterId: selection.litterId });
    return "reopened";
  }
  for (const kennelId of [selection.contract.sireKennelId, selection.contract.damKennelId]) {
    await createKennelNotice({ client: args.client, kennelId, sourceKey: `STUD_PUPPY_SELECTION_UNFULFILLABLE_DEATH:${selection.id}:${args.dogId}:${kennelId}`, type: "KENNEL_SERVICE", title: "Puppy Back cannot be fulfilled", body: "The selected contract puppy died and no qualifying replacement is available. The Puppy Back portion of this contract cannot be fulfilled.", currentEpoch: args.currentEpoch, linkedDogId: selection.contract.sireDogId, linkedLitterId: selection.litterId });
  }
  return "unfulfillable";
}

export async function selectDamProtectedPuppy(args: { kennelId: string; selectionId: string; puppyId: string; currentEpoch: number; now?: Date }) {
  const now = args.now ?? new Date();
  const deadline = new Date(now.getTime() + PUPPY_SELECTION_TURN_MS);
  return db.$transaction(async (tx) => {
    const selection = await tx.studContractPuppySelection.findUnique({
      where: { id: args.selectionId },
      select: { id: true, litterId: true, status: true, currentActor: true, turnDeadlineAt: true, damFirstPickDogId: true, contract: { select: { damKennelId: true, sireKennelId: true, sireDogId: true } } },
    });
    if (!selection || selection.status !== "DAM_FIRST_PICK" || selection.currentActor !== "DAM_OWNER" || selection.contract.damKennelId !== args.kennelId || !selection.turnDeadlineAt || now >= selection.turnDeadlineAt || selection.damFirstPickDogId) throw new Error("This protected first-pick turn is not available.");
    await loadSelectablePuppy({ client: tx, litterId: selection.litterId, puppyId: args.puppyId });
    const update = await tx.studContractPuppySelection.updateMany({
      where: { id: selection.id, status: "DAM_FIRST_PICK", currentActor: "DAM_OWNER", damFirstPickDogId: null, turnDeadlineAt: { gt: now } },
      data: { damFirstPickDogId: args.puppyId, status: "STUD_PICK", currentActor: "STUD_OWNER", turnStartedAt: now, turnDeadlineAt: deadline },
    });
    if (update.count !== 1) throw new Error("This protected first-pick turn is no longer available.");
    await createKennelNotice({ client: tx, kennelId: selection.contract.sireKennelId, sourceKey: `STUD_PUPPY_SELECTION_DAM_PICK:${selection.id}`, type: "KENNEL_SERVICE", title: "Stud puppy selection is ready", body: "The dam owner made the protected first pick. Your Second Pick selection turn is now open for 24 real hours.", currentEpoch: args.currentEpoch, linkedDogId: selection.contract.sireDogId, linkedLitterId: selection.litterId });
    return { selectionId: selection.id, state: "STUD_PICK" };
  });
}

export async function selectStudContractPuppy(args: { kennelId: string; selectionId: string; puppyId: string; currentEpoch: number; now?: Date }) {
  const now = args.now ?? new Date();
  return db.$transaction(async (tx) => {
    const selection = await tx.studContractPuppySelection.findUnique({
      where: { id: args.selectionId },
      select: { id: true, litterId: true, status: true, currentActor: true, turnDeadlineAt: true, damFirstPickDogId: true, selectedDogId: true, contract: { select: { sireKennelId: true, damKennelId: true, sireDogId: true, damDogId: true, puppySex: true } } },
    });
    if (!selection || selection.status !== "STUD_PICK" || selection.currentActor !== "STUD_OWNER" || selection.contract.sireKennelId !== args.kennelId || !selection.turnDeadlineAt || now >= selection.turnDeadlineAt || selection.selectedDogId) throw new Error("This stud selection turn is not available.");
    const puppy = await loadSelectablePuppy({ client: tx, litterId: selection.litterId, puppyId: args.puppyId });
    if (puppy.id === selection.damFirstPickDogId) throw new Error("The dam owner's protected puppy cannot be selected.");
    if (selection.contract.puppySex === "MALE" && puppy.sex !== "M") throw new Error("Select a male puppy for this contract.");
    if (selection.contract.puppySex === "FEMALE" && puppy.sex !== "F") throw new Error("Select a female puppy for this contract.");
    const update = await tx.studContractPuppySelection.updateMany({
      where: { id: selection.id, status: "STUD_PICK", currentActor: "STUD_OWNER", selectedDogId: null, turnDeadlineAt: { gt: now } },
      data: { selectedDogId: puppy.id, status: "SELECTED", currentActor: "NONE", turnStartedAt: null, turnDeadlineAt: null },
    });
    if (update.count !== 1) throw new Error("This stud selection turn is no longer available.");
    for (const kennelId of [selection.contract.sireKennelId, selection.contract.damKennelId]) await createKennelNotice({ client: tx, kennelId, sourceKey: `STUD_PUPPY_SELECTION_STUD_PICK:${selection.id}:${kennelId}`, type: "KENNEL_SERVICE", title: "Puppy Back selection recorded", body: "The Puppy Back selection has been recorded. Ownership transfer is not part of this step.", currentEpoch: args.currentEpoch, linkedDogId: puppy.id, linkedLitterId: selection.litterId });
    return { selectionId: selection.id, state: "SELECTED" };
  });
}
