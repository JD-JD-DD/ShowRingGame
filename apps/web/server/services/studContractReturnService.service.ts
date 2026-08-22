import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type ReturnServiceClient = typeof db | Prisma.TransactionClient;
type ReturnServiceExtinguishmentReason =
  | "OWNERSHIP_TRANSFER"
  | "DOG_DEATH"
  | "PERMANENT_BREEDING_INELIGIBILITY"
  | "SIRE_OWNERSHIP_CHANGED"
  | "DAM_OWNERSHIP_CHANGED"
  | "SIRE_DIED"
  | "DAM_DIED";

export const STUD_CONTRACT_RETURN_SERVICE_DURATION_MS = 60 * 24 * 60 * 60 * 1000;

export async function createStudContractReturnService(args: {
  client: ReturnServiceClient;
  contractId: string;
  trigger: "NO_LITTER" | "SMALL_LITTER";
  availableAt: Date;
}) {
  return args.client.studContractReturnService.upsert({
    where: { contractId: args.contractId },
    create: {
      contractId: args.contractId,
      trigger: args.trigger,
      availableAt: args.availableAt,
      expiresAt: new Date(args.availableAt.getTime() + STUD_CONTRACT_RETURN_SERVICE_DURATION_MS),
    },
    update: {},
    select: { id: true, status: true, trigger: true, availableAt: true, expiresAt: true },
  });
}

export async function extinguishStudContractReturnServicesForDog(args: {
  client: ReturnServiceClient;
  dogId: string;
  extinguishedAt: Date;
  sireReason?: ReturnServiceExtinguishmentReason;
  damReason?: ReturnServiceExtinguishmentReason;
}) {
  const sireCount = args.sireReason
    ? (await args.client.studContractReturnService.updateMany({
      where: { status: "AVAILABLE", contract: { sireDogId: args.dogId } },
      data: { status: "EXTINGUISHED", extinguishedAt: args.extinguishedAt, extinguishmentReason: args.sireReason },
    })).count
    : 0;
  const damCount = args.damReason
    ? (await args.client.studContractReturnService.updateMany({
      where: { status: "AVAILABLE", contract: { damDogId: args.dogId } },
      data: { status: "EXTINGUISHED", extinguishedAt: args.extinguishedAt, extinguishmentReason: args.damReason },
    })).count
    : 0;
  return { sireCount, damCount };
}
