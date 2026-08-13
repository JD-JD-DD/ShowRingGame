import HealthClearBadge from "@/components/dogs/HealthClearBadge";
import type { PhenotypeHealthBadgeStatus } from "@/lib/dogHealth";

type DogStatusBadgesProps = {
  healthStatus?: PhenotypeHealthBadgeStatus | null;
  fullHealthClearance?: boolean;
  isListedForSale?: boolean;
  isListedAtStud?: boolean;
  isPregnant?: boolean;
  size?: "sm" | "lg";
};

const FOR_SALE_STATUS_INDICATOR = "\u{1F4B2}";
const AT_STUD_STATUS_INDICATOR = "\u{1F9EC}";
const PREGNANT_STATUS_INDICATOR = "P";

const LISTING_SIZE_STYLES = {
  sm: "h-5 w-5 text-[0.7rem]",
  lg: "h-8 w-8 text-base sm:h-9 sm:w-9",
};

export default function DogStatusBadges({
  healthStatus = null,
  fullHealthClearance = false,
  isListedForSale = false,
  isListedAtStud = false,
  isPregnant = false,
  size = "sm",
}: DogStatusBadgesProps) {
  if (!healthStatus && !isListedForSale && !isListedAtStud && !isPregnant) {
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
          className={`theme-status-success inline-flex shrink-0 items-center justify-center rounded-full font-bold ${LISTING_SIZE_STYLES[size]}`}
        >
          {FOR_SALE_STATUS_INDICATOR}
        </span>
      ) : null}
      {isListedAtStud ? (
        <span
          title="Dog is listed at stud"
          aria-label="Dog is listed at stud"
          className={`theme-status-info inline-flex shrink-0 items-center justify-center rounded-full font-bold ${LISTING_SIZE_STYLES[size]}`}
        >
          {AT_STUD_STATUS_INDICATOR}
        </span>
      ) : null}
      {isPregnant ? (
        <span
          title="Dog is confirmed pregnant"
          aria-label="Dog is confirmed pregnant"
          className={`theme-status-neutral inline-flex shrink-0 items-center justify-center rounded-full font-bold ${LISTING_SIZE_STYLES[size]}`}
        >
          {PREGNANT_STATUS_INDICATOR}
        </span>
      ) : null}
    </span>
  );
}
