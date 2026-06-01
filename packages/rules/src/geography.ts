
import { DISTANCE_TIER_LABEL, DistanceTier } from "../constants/geography.constants";
import { DISTRICT_DISTANCE_MATRIX } from "../constants/geography.constants";
import { SHOW_DISTRICT_REGIONS } from "../constants/geography.constants";

// helper, how far apart are districts
export function getDistrictDistanceTier(
  fromDistrict: number,
  toDistrict: number
): DistanceTier {
  if (fromDistrict < 1 || fromDistrict > SHOW_DISTRICT_REGIONS.length) {
    throw new Error(`Invalid fromDistrict: ${fromDistrict}`);
  }

  if (toDistrict < 1 || toDistrict > SHOW_DISTRICT_REGIONS.length) {
    throw new Error(`Invalid toDistrict: ${toDistrict}`);
  }

  const fromIndex = fromDistrict - 1;
  const toIndex = toDistrict - 1;

  return DISTRICT_DISTANCE_MATRIX[fromIndex][toIndex] as DistanceTier;
}


/**
 * Returns the human readable name for a distance tier.
 * Example: 3 → "Regional"
 */
export function getDistanceTierLabel(tier: DistanceTier): string {
  return DISTANCE_TIER_LABEL[tier];
}

export function getShowDistrictRegion(district: number) {
  const region = SHOW_DISTRICT_REGIONS.find(
    (candidate) => candidate.district === district
  );

  if (!region) {
    throw new Error(`Invalid district: ${district}`);
  }

  return region;
}

/**
 * Returns the player-facing region name for a numeric show district.
 * Numeric districts remain the stable values used for storage and rules.
 */
export function getShowDistrictRegionName(district: number): string {
  return getShowDistrictRegion(district).name;
}
