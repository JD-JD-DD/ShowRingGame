import Link from "next/link";

import type { LitterListItemDto } from "@/server/mappers/litter.mapper";
import { formatGameAge } from "@/lib/gameTimeFormat";
import { getLitterDisplayName } from "@/lib/litterDisplayName";
import { formatShowCalendarLabel } from "@/lib/showCalendarLabels";

const focusLinkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";

export function EmptyLittersState() {
  return (
    <div className="theme-card rounded-2xl p-8 text-center">
      <h3 className="theme-heading text-xl font-semibold">No litters yet</h3>
      <p className="theme-copy mx-auto mt-3 max-w-2xl text-sm leading-7">
        Once a pregnant dam reaches her due date, the litter engine will create
        puppies and they will appear here.
      </p>
      <Link
        href="/kennel"
        className="theme-primary-button mt-5 inline-flex rounded-xl px-5 py-3 text-sm font-semibold"
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
          className="theme-card-interactive rounded-2xl p-5"
        >
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="theme-neutral-badge rounded-full px-3 py-1 text-xs font-semibold">
                  {litter.breedName} ({litter.breedCode2})
                </span>
              </div>

              <div className="mt-4">
                <div className="theme-heading text-2xl font-semibold">
                  {getLitterDisplayName(litter.customName, litter.serial7)}
                </div>
                {litter.customName ? (
                  <div className="theme-copy mt-1 text-sm">Serial {litter.serial7}</div>
                ) : null}
              </div>

              <h3 className="theme-heading mt-3 text-2xl font-semibold">
                <Link href={`/dogs/${litter.dam.dogId}`} className={`hover:underline ${focusLinkClass}`}>
                  {litter.dam.displayName}
                </Link>{" "}
                x{" "}
                <Link href={`/dogs/${litter.sire.dogId}`} className={`hover:underline ${focusLinkClass}`}>
                  {litter.sire.displayName}
                </Link>
              </h3>
              <p className="theme-copy mt-2 text-sm">
                Whelped: {formatShowCalendarLabel(litter.bornEpoch)}. Litter age: {formatGameAge(litter.ageHours)}. Bred by{" "}
                {litter.bredByKennelName ?? "Unknown kennel"}
              </p>

              <div className="theme-copy mt-4 flex flex-wrap gap-3 text-sm">
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
                  className={`theme-card-interactive rounded-xl p-3 ${focusLinkClass}`}
                >
                  <div className="theme-label text-xs">
                    Puppy {puppy.litterOrder ?? "-"} {puppy.sex}
                  </div>
                  <div className="theme-heading mt-1 truncate text-sm font-semibold">
                    {puppy.displayName}
                  </div>
                  <div className="theme-copy mt-1 truncate text-xs">
                    {puppy.regNumber}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <Link
            href={`/litters/${litter.litterId}`}
            className={`theme-accent-link mt-5 inline-flex text-sm font-semibold underline underline-offset-4 ${focusLinkClass}`}
          >
            View litter record
          </Link>
        </article>
      ))}
    </div>
  );
}
