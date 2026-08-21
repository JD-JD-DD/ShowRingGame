import { db } from "@/lib/db";

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
