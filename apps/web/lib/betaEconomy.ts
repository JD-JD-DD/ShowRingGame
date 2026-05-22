import { db } from "@/lib/db";

const ENABLE_BETA_BALANCE_TOP_UP = true;
const BETA_BALANCE_THRESHOLD = 10_000;
const BETA_BALANCE_TOP_UP_AMOUNT = 25_000;

type ApplyBetaBalanceTopUpArgs = {
  kennelId: string;
  currentEpoch: number;
};

type BetaBalanceTopUpResult = {
  applied: boolean;
  previousBalance: number | null;
  newBalance: number | null;
  amountAdded: number;
};

export async function applyBetaBalanceTopUp(
  args: ApplyBetaBalanceTopUpArgs
): Promise<BetaBalanceTopUpResult> {
  const { kennelId, currentEpoch } = args;

  if (!ENABLE_BETA_BALANCE_TOP_UP) {
    return {
      applied: false,
      previousBalance: null,
      newBalance: null,
      amountAdded: 0,
    };
  }

  const result = await db.$transaction(async (tx) => {
    const kennel = await tx.kennel.findUnique({
      where: { id: kennelId },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    if (kennel.balance >= BETA_BALANCE_THRESHOLD) {
      return {
        applied: false,
        previousBalance: kennel.balance,
        newBalance: kennel.balance,
        amountAdded: 0,
      };
    }

    const newBalance = kennel.balance + BETA_BALANCE_TOP_UP_AMOUNT;

    await tx.kennel.update({
      where: { id: kennel.id },
      data: {
        balance: newBalance,
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        kennelId: kennel.id,
        transactionType: "REFUND",
        amount: BETA_BALANCE_TOP_UP_AMOUNT,
        balanceAfter: newBalance,
        occurredAtEpoch: currentEpoch,
        memo: "Beta auto top-up",
      },
    });

    return {
      applied: true,
      previousBalance: kennel.balance,
      newBalance,
      amountAdded: BETA_BALANCE_TOP_UP_AMOUNT,
    };
  });

  return result;
}

export function isBetaBalanceTopUpEnabled(): boolean {
  return ENABLE_BETA_BALANCE_TOP_UP;
}

export async function applyBetaBalanceTopUpToKennel<
  T extends { id: string; balance: number },
>(
  kennel: T | null,
  currentEpoch: number
): Promise<T | null> {
  if (!kennel) {
    return null;
  }

  const topUp = await applyBetaBalanceTopUp({
    kennelId: kennel.id,
    currentEpoch,
  });

  if (!topUp.applied || topUp.newBalance == null) {
    return kennel;
  }

  return {
    ...kennel,
    balance: topUp.newBalance,
  };
}
