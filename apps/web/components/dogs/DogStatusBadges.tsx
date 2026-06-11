import HealthClearBadge from "@/components/dogs/HealthClearBadge";
import type { PhenotypeHealthBadgeStatus } from "@/lib/dogHealth";

type DogStatusBadgesProps = {
  healthStatus?: PhenotypeHealthBadgeStatus | null;
  fullHealthClearance?: boolean;
  isListedForSale?: boolean;
  isListedAtStud?: boolean;
  size?: "sm" | "lg";
};

const LISTING_SIZE_STYLES = {
  sm: "h-5 w-5 text-[0.7rem]",
  lg: "h-8 w-8 text-base sm:h-9 sm:w-9",
};

export default function DogStatusBadges({
  healthStatus = null,
  fullHealthClearance = false,
  isListedForSale = false,
  isListedAtStud = false,
  size = "sm",
}: DogStatusBadgesProps) {
  if (!healthStatus && !isListedForSale && !isListedAtStud) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {healthStatus ? (
        <HealthClearBadge
          status={healthStatus}
          fullClearance={fullHealthClearance}
          size={size}
        />
      ) : null}
      {isListedForSale ? (
        <span
          title="Dog is listed for sale"
          aria-label="Dog is listed for sale"
          className={`inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-500/20 font-bold text-emerald-100 ${LISTING_SIZE_STYLES[size]}`}
        >
          💲
        </span>
      ) : null}
      {isListedAtStud ? (
        <span
          title="Dog is listed at stud"
          aria-label="Dog is listed at stud"
          className={`inline-flex shrink-0 items-center justify-center rounded-full border border-sky-300/55 bg-sky-500/20 font-bold text-sky-100 ${LISTING_SIZE_STYLES[size]}`}
        >
          🧬
        </span>
      ) : null}
    </span>
  );
}
