import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type ReturnServiceClient = typeof db | Prisma.TransactionClient;

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
