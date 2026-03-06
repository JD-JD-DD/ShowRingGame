

import { DISTRICT_DISTANCE_MATRIX } from "../constants/geography.constants";

// helper, how far apart are districts
export function getDistrictDistanceTier(
  fromDistrict: number,
  toDistrict: number
): number {
  if (fromDistrict < 1 || fromDistrict > 15) {
    throw new Error(`Invalid fromDistrict: ${fromDistrict}`);
  }

  if (toDistrict < 1 || toDistrict > 15) {
    throw new Error(`Invalid toDistrict: ${toDistrict}`);
  }

  const fromIndex = fromDistrict - 1;
  const toIndex = toDistrict - 1;

  return DISTRICT_DISTANCE_MATRIX[fromIndex][toIndex];
}