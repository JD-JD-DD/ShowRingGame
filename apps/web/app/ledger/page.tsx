import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";

function formatMoney(amount: number): string {
  const absoluteAmount = Math.abs(amount).toLocaleString();
  return amount < 0 ? `-$${absoluteAmount}` : `$${absoluteAmount}`;
}

function formatTransactionType(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLedgerTime(epoch: number): string {
  return epochToDate(epoch).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default async function LedgerPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      balance: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const transactions = await db.ledgerTransaction.findMany({
    where: {
      kennelId: kennel.id,
    },
    orderBy: [{ occurredAtEpoch: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      transactionType: true,
      amount: true,
      balanceAfter: true,
      occurredAtEpoch: true,
      memo: true,
      dog: {
        select: {
          id: true,
          registeredName: true,
          callName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
        },
      },
      showCluster: {
        select: {
          name: true,
        },
      },
      counterpartyKennel: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
              Kennel Ledger
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              {kennel.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Review recent kennel income, purchases, fees, and balance changes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/kennel"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              My Kennel
            </Link>
            <Link
              href="/"
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              Home
            </Link>
          </div>
        </div>

        <div className="mt-5 inline-flex rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-2 text-sm text-purple-100/80">
          Current balance: {formatMoney(kennel.balance)}
        </div>
      </section>

      {transactions.length === 0 ? (
        <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 text-sm text-purple-100/75">
          No transactions have been recorded yet.
        </section>
      ) : (
        <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Dog</th>
                  <th className="px-3 py-2">Show / Kennel</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2">Memo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                  >
                    <td className="rounded-l-2xl px-3 py-3 text-purple-100/75">
                      {formatLedgerTime(transaction.occurredAtEpoch)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-white">
                      {formatTransactionType(transaction.transactionType)}
                    </td>
                    <td className="px-3 py-3 text-purple-100/80">
                      {transaction.dog ? (
                        <Link
                          href={`/dogs/${transaction.dog.id}`}
                          className="font-medium text-purple-100 underline-offset-4 hover:underline"
                        >
                          {formatDogDisplayName(transaction.dog)}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-purple-100/80">
                      {transaction.showCluster?.name ??
                        transaction.counterpartyKennel?.name ??
                        "-"}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-semibold ${
                        transaction.amount < 0
                          ? "text-rose-200"
                          : "text-emerald-200"
                      }`}
                    >
                      {formatMoney(transaction.amount)}
                    </td>
                    <td className="px-3 py-3 text-right text-purple-100/80">
                      {transaction.balanceAfter == null
                        ? "-"
                        : formatMoney(transaction.balanceAfter)}
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 text-purple-100/70">
                      {transaction.memo ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
