import Link from "next/link";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";
import TraitLine from "@/components/ui/TraitLine";

const focusLinkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";

const VISIBLE_CATEGORY_LABELS: Record<string, string> = {
  typeExpression: "Type & Expression",
  structureBalance: "Structure & Balance",
  movement: "Movement",
  coatPresentation: "Coat & Presentation",
  temperamentRingBehavior: "Temperament & Ring Behavior",
  conditioningHandling: "Conditioning & Handling",
};

function formatCategoryName(key: string): string {
  return (
    VISIBLE_CATEGORY_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function marketStateLabel(marketState: string): string | null {
  switch (marketState) {
    case "LISTED_PLAYER":
    case "LISTED_NPC":
      return "Listed for sale";
    case "SOLD_PENDING_TRANSFER":
      return "Sale pending transfer";
    default:
      return null;
  }
}

export function LitterPuppyCard({
  puppy,
  isSelected,
  onSelectionChange,
}: {
  puppy: LitterPuppyDto;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
}) {
  const visibleCategories = Object.entries(puppy.visibleCategories).filter(
    ([key]) => key !== "conditioningHandling"
  );
  const marketLabel = marketStateLabel(puppy.marketState);

  return (
    <article className="theme-card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="theme-label text-xs uppercase tracking-wide">
            Puppy {puppy.litterOrder ?? "-"} / {puppy.sex}
          </div>
          {puppy.isNeonatalLoss ? (
            <div className="theme-heading mt-2 text-xl font-semibold">
              Litter loss
            </div>
          ) : (
            <Link
              href={`/dogs/${puppy.dogId}`}
              className={`mt-2 block text-xl font-semibold hover:underline ${focusLinkClass}`}
            >
              {puppy.displayName}
            </Link>
          )}
          <div className="theme-copy mt-1 text-sm">{puppy.regNumber}</div>
        </div>
        <div className="flex items-center gap-2">
          {puppy.isManageableByBreeder ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(event) => onSelectionChange(event.target.checked)}
                aria-label={`Select ${puppy.displayName}, ${puppy.regNumber}`}
                className="size-4 accent-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              />
              <span>Select</span>
            </label>
          ) : null}
          <div className="theme-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
            {statusLabel(puppy.lifecycleState)}
          </div>
        </div>
      </div>

      {puppy.isNeonatalLoss ? (
        <div className="theme-card theme-copy mt-5 rounded-xl p-4 text-sm">
          This puppy was lost before placement age and is preserved here as part
          of the litter record.
        </div>
      ) : (
        <>
          {puppy.currentOwnerKennel || puppy.kennelRun || marketLabel ? (
            <dl className="theme-copy mt-5 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
              {puppy.currentOwnerKennel ? (
                <div>
                  <dt className="theme-label text-xs uppercase tracking-wide">
                    Current kennel
                  </dt>
                  <dd className="mt-1 font-medium">
                    {puppy.currentOwnerKennel.name}
                  </dd>
                </div>
              ) : null}
              {puppy.kennelRun ? (
                <div>
                  <dt className="theme-label text-xs uppercase tracking-wide">
                    Kennel run
                  </dt>
                  <dd className="mt-1 font-medium">{puppy.kennelRun.name}</dd>
                </div>
              ) : null}
              {marketLabel ? (
                <div>
                  <dt className="theme-label text-xs uppercase tracking-wide">
                    Sale status
                  </dt>
                  <dd className="mt-1 font-medium">{marketLabel}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {visibleCategories.map(([key, value]) => (
              <TraitLine
                key={key}
                label={formatCategoryName(key)}
                value={value}
                precision={3}
                min={0}
                max={20}
                ideal={10}
                leftLabel="Under ideal"
                rightLabel="Over ideal"
              />
            ))}
          </div>
        </>
      )}
    </article>
  );
}
