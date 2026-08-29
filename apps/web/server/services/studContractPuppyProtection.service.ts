import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";

type StudContractPuppyProtectionClient = Pick<PrismaClient, "dog" | "studContractPuppySelection">;

export type StudContractPuppyProtection = {
  protected: boolean;
  reasonCode: "ACTIVE_SELECTION" | "SELECTED_CLAIM" | null;
  selectionId: string | null;
  selectionState: string | null;
  contractId: string | null;
};

type StudContractPuppyProtectionDog = {
  id: string;
  litterId: string | null;
  sex: string;
  lifecycleState: string;
};

type StudContractPuppyProtectionBatchClient = Pick<
  PrismaClient,
  "studContractPuppySelection"
>;

const unprotectedPuppy: StudContractPuppyProtection = {
  protected: false,
  reasonCode: null,
  selectionId: null,
  selectionState: null,
  contractId: null,
};

function evaluateStudContractPuppyProtection(args: {
  dog: StudContractPuppyProtectionDog;
  selections: Array<{
    id: string;
    status: string;
    damFirstPickDogId: string | null;
    selectedDogId: string | null;
    contract: { id: string; puppyPickPosition: string | null; puppySex: string | null };
  }>;
}): StudContractPuppyProtection {
  for (const selection of args.selections) {
    if (selection.status === "SELECTED" && selection.selectedDogId === args.dog.id) return { protected: true, reasonCode: "SELECTED_CLAIM", selectionId: selection.id, selectionState: selection.status, contractId: selection.contract.id };
    if (selection.status === "DAM_FIRST_PICK" || (selection.status === "WAITING" && selection.contract.puppyPickPosition === "SECOND")) return { protected: true, reasonCode: "ACTIVE_SELECTION", selectionId: selection.id, selectionState: selection.status, contractId: selection.contract.id };
    if ((selection.status === "STUD_PICK" || (selection.status === "WAITING" && selection.contract.puppyPickPosition === "FIRST")) && args.dog.id !== selection.damFirstPickDogId && (selection.contract.puppySex === "EITHER" || selection.contract.puppySex === null || (selection.contract.puppySex === "MALE" ? args.dog.sex === "M" : args.dog.sex === "F"))) return { protected: true, reasonCode: "ACTIVE_SELECTION", selectionId: selection.id, selectionState: selection.status, contractId: selection.contract.id };
  }
  return unprotectedPuppy;
}

export async function getStudContractPuppyProtectionsForDogs(args: {
  dogs: StudContractPuppyProtectionDog[];
  client?: StudContractPuppyProtectionBatchClient;
}): Promise<Map<string, StudContractPuppyProtection>> {
  const client = args.client ?? db;
  const dogs = args.dogs.filter((dog) => dog.litterId && dog.lifecycleState === "ALIVE");
  const protections = new Map<string, StudContractPuppyProtection>();
  const litterIds = [...new Set(dogs.flatMap((dog) => dog.litterId ? [dog.litterId] : []))];
  if (litterIds.length === 0) return protections;
  const selections = await client.studContractPuppySelection.findMany({
    where: { litterId: { in: litterIds }, status: { in: ["WAITING", "DAM_FIRST_PICK", "STUD_PICK", "SELECTED"] } },
    select: { id: true, litterId: true, status: true, damFirstPickDogId: true, selectedDogId: true, contract: { select: { id: true, puppyPickPosition: true, puppySex: true } } },
  });
  for (const dog of dogs) {
    protections.set(dog.id, evaluateStudContractPuppyProtection({
      dog,
      selections: selections.filter((selection) => selection.litterId === dog.litterId),
    }));
  }
  return protections;
}

export async function getStudContractPuppyProtection(args: { dogId: string; client?: StudContractPuppyProtectionClient }): Promise<StudContractPuppyProtection> {
  const client = args.client ?? db;
  const dog = await client.dog.findUnique({ where: { id: args.dogId }, select: { id: true, litterId: true, sex: true, lifecycleState: true } });
  if (!dog?.litterId || dog.lifecycleState !== "ALIVE") return unprotectedPuppy;
  return (await getStudContractPuppyProtectionsForDogs({ dogs: [dog], client })).get(dog.id) ?? unprotectedPuppy;
}

export async function assertDogNotProtectedByStudContractSelection(args: { dogId: string; action: "listed for sale" | "rehomed" | "transferred" | "removed"; client?: StudContractPuppyProtectionClient }) {
  const protection = await getStudContractPuppyProtection(args);
  if (protection.protected) throw new Error(protection.reasonCode === "SELECTED_CLAIM" ? `This puppy has been selected under an active Stud Contract and cannot be ${args.action} yet.` : `This puppy is part of an active Stud Contract selection and cannot be ${args.action} yet.`);
}

export async function assertDogsNotProtectedByStudContractSelection(args: { dogIds: string[]; action: "listed for sale" | "rehomed" | "transferred" | "removed"; client?: StudContractPuppyProtectionClient }) {
  const client = args.client ?? db;
  const dogs = await client.dog.findMany({ where: { id: { in: args.dogIds }, litterId: { not: null }, lifecycleState: "ALIVE" }, select: { id: true, litterId: true, sex: true } });
  const litterIds = [...new Set(dogs.flatMap((dog) => dog.litterId ? [dog.litterId] : []))];
  if (litterIds.length === 0) return;
  const selections = await client.studContractPuppySelection.findMany({
    where: { litterId: { in: litterIds }, status: { in: ["WAITING", "DAM_FIRST_PICK", "STUD_PICK", "SELECTED"] } },
    select: { id: true, litterId: true, status: true, damFirstPickDogId: true, selectedDogId: true, contract: { select: { id: true, puppyPickPosition: true, puppySex: true } } },
  });
  for (const dog of dogs) {
    for (const selection of selections) {
      if (selection.litterId !== dog.litterId) continue;
      const selected = selection.status === "SELECTED" && selection.selectedDogId === dog.id;
      const wholeLitter = selection.status === "DAM_FIRST_PICK" || (selection.status === "WAITING" && selection.contract.puppyPickPosition === "SECOND");
      const matchesStudPick = (selection.status === "STUD_PICK" || (selection.status === "WAITING" && selection.contract.puppyPickPosition === "FIRST")) && dog.id !== selection.damFirstPickDogId && (selection.contract.puppySex === "EITHER" || selection.contract.puppySex === null || (selection.contract.puppySex === "MALE" ? dog.sex === "M" : dog.sex === "F"));
      if (selected || wholeLitter || matchesStudPick) {
        throw new Error(selected ? `This puppy has been selected under an active Stud Contract and cannot be ${args.action} yet.` : `This puppy is part of an active Stud Contract selection and cannot be ${args.action} yet.`);
      }
    }
  }
}
