import { db } from "@/lib/db";

export async function authorizeReproductiveEmergencyTreatment(args: {
  eventId: string;
  kennelId: string;
  currentEpoch: number;
}) {
  return db.$transaction(async (tx) => {
    const event = await tx.reproductiveEmergencyEvent.findUnique({
      where: { id: args.eventId },
      include: {
        dam: { select: { id: true, ownerKennelId: true, lifecycleState: true } },
        breedingAttempt: { select: { id: true, status: true } },
      },
    });
    if (!event) throw new Error("Reproductive emergency event not found.");
    if (event.status !== "PENDING") {
      throw new Error("Emergency treatment has already been authorized or resolved.");
    }
    if (event.ledgerTransactionId) throw new Error("Emergency treatment has already been paid.");
    if (args.currentEpoch > event.responseDeadlineEpoch) {
      throw new Error("The treatment window has expired.");
    }
    if (event.dam.lifecycleState !== "ALIVE") {
      throw new Error("Only a living dam can receive emergency treatment.");
    }
    if (
      event.dam.ownerKennelId !== args.kennelId ||
      event.kennelIdAtEvent !== args.kennelId
    ) {
      throw new Error("The dam ownership no longer matches this emergency care event.");
    }
    if (event.breedingAttempt.status !== "REPRODUCTIVE_EMERGENCY") {
      throw new Error("This breeding attempt is not awaiting reproductive emergency care.");
    }
    if (!Number.isInteger(event.treatmentCost) || event.treatmentCost <= 0) {
      throw new Error("Emergency treatment cost is invalid.");
    }
    const kennel = await tx.kennel.findUnique({
      where: { id: args.kennelId },
      select: { id: true, balance: true },
    });
    if (!kennel) throw new Error("Kennel not found.");
    if (kennel.balance < event.treatmentCost) {
      throw new Error("Insufficient funds for emergency veterinary care.");
    }
    const lock = await tx.reproductiveEmergencyEvent.updateMany({
      where: {
        id: event.id,
        status: "PENDING",
        ledgerTransactionId: null,
        responseDeadlineEpoch: { gte: args.currentEpoch },
      },
      data: { status: "TREATMENT_AUTHORIZED", treatmentAuthorizedEpoch: args.currentEpoch },
    });
    if (lock.count !== 1) throw new Error("Emergency treatment has already been processed.");
    const balanceAfter = kennel.balance - event.treatmentCost;
    await tx.kennel.update({ where: { id: kennel.id }, data: { balance: balanceAfter } });
    const ledger = await tx.ledgerTransaction.create({
      data: {
        kennelId: kennel.id,
        transactionType: "EMERGENCY_VET_CARE",
        amount: -event.treatmentCost,
        balanceAfter,
        occurredAtEpoch: args.currentEpoch,
        dogId: event.damId,
        memo: "Emergency veterinary care for whelping complication",
        metadataJson: { reproductiveEmergencyEventId: event.id, breedingAttemptId: event.breedingAttemptId, damId: event.damId },
      },
    });
    await tx.reproductiveEmergencyEvent.update({
      where: { id: event.id },
      data: { ledgerTransactionId: ledger.id },
    });
    console.info("reproductive emergency treatment authorized", {
      reproductiveEmergencyEventId: event.id, breedingAttemptId: event.breedingAttemptId,
      damId: event.damId, kennelId: kennel.id, treatmentCost: event.treatmentCost,
      treatmentAuthorizedEpoch: args.currentEpoch, ledgerTransactionId: ledger.id, balanceAfter,
    });
    return { eventId: event.id, ledgerTransactionId: ledger.id, balanceAfter, treatmentAuthorizedEpoch: args.currentEpoch };
  });
}
