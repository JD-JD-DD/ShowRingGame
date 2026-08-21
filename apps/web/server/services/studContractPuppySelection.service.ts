import { db } from "@/lib/db";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import type { Prisma } from "@prisma/client";

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
