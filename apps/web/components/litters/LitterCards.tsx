import Link from "next/link";

import type { LitterListItemDto } from "@/server/mappers/litter.mapper";

function formatGameDays(hours: number): string {
  if (hours <= 0) return "Ready";
  if (hours === 1) return "1 day";
  return `${hours} days`;
}

export function EmptyLittersState() {
  return (
    <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-8 text-center">
      <h3 className="text-xl font-semibold">No litters yet</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--dog-copy)]">
        Once a pregnant dam reaches her due date, the litter engine will create
        puppies and they will appear here.
      </p>
      <Link
        href="/kennel"
        className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold transition hover:bg-emerald-500"
      >
        Visit My Kennel
      </Link>
    </div>
  );
}

export function LitterCards({ litters }: { litters: LitterListItemDto[] }) {
  return (
    <div className="grid gap-5">
      {litters.map((litter) => (
        <Link
          key={litter.litterId}
          href={`/litters/${litter.litterId}`}
          className="group rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5 shadow-[var(--dog-shadow)] transition hover:border-emerald-200/35 hover:bg-[var(--dog-card)]"
        >
          <article className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {litter.breedName} ({litter.breedCode2})
                </span>
                <span className="rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-1 text-xs text-[var(--dog-heading)]">
                  Serial {litter.serial7}
                </span>
              </div>

              <h3 className="mt-4 text-2xl font-semibold text-white">
                {litter.dam.displayName} x {litter.sire.displayName}
              </h3>
              <p className="mt-2 text-sm text-[var(--dog-copy)]">
                Whelped {formatGameDays(litter.ageHours)} ago by{" "}
                {litter.bredByKennelName ?? "Unknown kennel"}
              </p>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--dog-copy)]">
                <span>Born: {litter.pupCount}</span>
                <span>Survived: {litter.survivedCount}</span>
                <span>{litter.maleCount} dogs</span>
                <span>{litter.femaleCount} bitches</span>
                {litter.neonatalLossCount > 0 ? (
                  <span>Lost before placement: {litter.neonatalLossCount}</span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {litter.puppiesPreview.map((puppy) => (
                <div
                  key={puppy.dogId}
                  className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3"
                >
                  <div className="text-xs text-[var(--dog-label)]">
                    Puppy {puppy.litterOrder ?? "-"} {puppy.sex}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-white">
                    {puppy.displayName}
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--dog-copy)]">
                    {puppy.regNumber}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}
