import Link from "next/link";

import type { LitterListItemDto } from "@/server/mappers/litter.mapper";
import { formatGameAge } from "@/lib/gameTimeFormat";
import { formatShowCalendarLabel } from "@/lib/showCalendarLabels";

const focusLinkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";

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
        <article
          key={litter.litterId}
          className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5 shadow-[var(--dog-shadow)] transition hover:border-emerald-200/35 hover:bg-[var(--dog-card)]"
        >
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
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
                <Link href={`/dogs/${litter.dam.dogId}`} className={`hover:underline ${focusLinkClass}`}>
                  {litter.dam.displayName}
                </Link>{" "}
                x{" "}
                <Link href={`/dogs/${litter.sire.dogId}`} className={`hover:underline ${focusLinkClass}`}>
                  {litter.sire.displayName}
                </Link>
              </h3>
              <p className="mt-2 text-sm text-[var(--dog-copy)]">
                Whelped: {formatShowCalendarLabel(litter.bornEpoch)}. Litter age: {formatGameAge(litter.ageHours)}. Bred by{" "}
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
                <Link
                  key={puppy.dogId}
                  href={`/dogs/${puppy.dogId}`}
                  aria-label={`View ${puppy.displayName}`}
                  className={`rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3 transition hover:border-emerald-200/35 ${focusLinkClass}`}
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
                </Link>
              ))}
            </div>
          </div>
          <Link
            href={`/litters/${litter.litterId}`}
            className={`mt-5 inline-flex text-sm font-semibold text-emerald-100 underline underline-offset-4 ${focusLinkClass}`}
          >
            View litter record
          </Link>
        </article>
      ))}
    </div>
  );
}
