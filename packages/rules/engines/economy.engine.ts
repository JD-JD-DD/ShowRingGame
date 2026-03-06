import { BASE_TRAVEL_COST } from "../constants/economy.constants";
import { getDistrictDistanceTier } from "../src/geography";


// travel cost calculator
export function calculateTravelCost(
  homeDistrict: number,
  showDistrict: number
): number {
  const tier = getDistrictDistanceTier(homeDistrict, showDistrict);

  return BASE_TRAVEL_COST[tier];
}


