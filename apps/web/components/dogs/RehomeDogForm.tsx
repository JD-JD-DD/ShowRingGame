"use client";

type RehomeDogFormProps = {
  action: string;
  dogName: string;
  payout: number;
  areaId?: string | null;
};

export default function RehomeDogForm({
  action,
  dogName,
  payout,
  areaId,
}: RehomeDogFormProps) {
  function confirmRehome(event: React.FormEvent<HTMLFormElement>) {
    const payoutMessage =
      payout > 0
        ? `\n\nYour kennel ledger will receive $${payout.toLocaleString()}.`
        : "";
    const confirmed = window.confirm(
      `Re-home ${dogName}?\n\nThis cannot be undone. The dog will leave your kennel and you will no longer be able to use it.${payoutMessage}`
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} method="post" onSubmit={confirmRehome}>
      {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
      <button
        type="submit"
        className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 px-5 py-3 text-center text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
      >
        Re-Home Dog
      </button>
    </form>
  );
}
