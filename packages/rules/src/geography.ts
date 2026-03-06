
// helper, how far apart are districts
import { DISTRICT_DISTANCE_MATRIX } from "../constants/geography.constants";

export function getDistrictDistanceTier(
  fromDistrict: number,
  toDistrict: number
): number {

  const fromIndex = fromDistrict - 1;
  const toIndex = toDistrict - 1;

  return DISTRICT_DISTANCE_MATRIX[fromIndex][toIndex];
}