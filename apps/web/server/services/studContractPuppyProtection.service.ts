import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type StudContractPuppyProtection = {
  protected: boolean;
  reasonCode: "ACTIVE_SELECTION" | "SELECTED_CLAIM" | null;
  selectionId: string | null;
  selectionState: string | null;
  contractId: string | null;
};

export async function getStudContractPuppyProtection(args: { dogId: string; client?: Prisma.TransactionClient }): Promise<StudContractPuppyProtection> {
  const client = args.client ?? db;
  const dog = await client.dog.findUnique({ where: { id: args.dogId }, select: { id: true, litterId: true, sex: true, lifecycleState: true } });
  if (!dog?.litterId || dog.lifecycleState !== "ALIVE") return { protected: false, reasonCode: null, selectionId: null, selectionState: null, contractId: null };
  const selections = await client.studContractPuppySelection.findMany({
    where: { litterId: dog.litterId, status: { in: ["WAITING", "DAM_FIRST_PICK", "STUD_PICK", "SELECTED"] } },
    select: { id: true, status: true, damFirstPickDogId: true, selectedDogId: true, contract: { select: { id: true, puppyPickPosition: true, puppySex: true } } },
  });
  for (const selection of selections) {
    if (selection.status === "SELECTED" && selection.selectedDogId === dog.id) return { protected: true, reasonCode: "SELECTED_CLAIM", selectionId: selection.id, selectionState: selection.status, contractId: selection.contract.id };
    if (selection.status === "DAM_FIRST_PICK" || (selection.status === "WAITING" && selection.contract.puppyPickPosition === "SECOND")) return { protected: true, reasonCode: "ACTIVE_SELECTION", selectionId: selection.id, selectionState: selection.status, contractId: selection.contract.id };
    if ((selection.status === "STUD_PICK" || (selection.status === "WAITING" && selection.contract.puppyPickPosition === "FIRST")) && dog.id !== selection.damFirstPickDogId && (selection.contract.puppySex === "EITHER" || selection.contract.puppySex === null || (selection.contract.puppySex === "MALE" ? dog.sex === "M" : dog.sex === "F"))) return { protected: true, reasonCode: "ACTIVE_SELECTION", selectionId: selection.id, selectionState: selection.status, contractId: selection.contract.id };
  }
  return { protected: false, reasonCode: null, selectionId: null, selectionState: null, contractId: null };
}

export async function assertDogNotProtectedByStudContractSelection(args: { dogId: string; action: "named" | "listed for sale" | "rehomed" | "transferred" | "removed"; client?: Prisma.TransactionClient }) {
  const protection = await getStudContractPuppyProtection(args);
  if (protection.protected) throw new Error(protection.reasonCode === "SELECTED_CLAIM" ? `This puppy has been selected under an active Stud Contract and cannot be ${args.action} yet.` : `This puppy is part of an active Stud Contract selection and cannot be ${args.action} yet.`);
}
