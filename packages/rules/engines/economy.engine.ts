import { BASE_TRAVEL_COST, TRAVEL_COST_PER_DOG } from "../constants/economy.constants";
import { getDistrictDistanceTier } from "../src/geography";

export type TravelCostBreakdown = {
  tier: number;
  kennelTravelCost: number;
  dogTravelCost: number;
  dogsTraveling: number;
  totalCost: number;
};

export function getTravelCostBreakdown(
  homeDistrict: number,
  showDistrict: number,
  dogsTraveling: number
): TravelCostBreakdown {
  const tier = getDistrictDistanceTier(homeDistrict, showDistrict);

  const kennelTravelCost = BASE_TRAVEL_COST[tier];
  const dogTravelCost = dogsTraveling * TRAVEL_COST_PER_DOG;
  const totalCost = kennelTravelCost + dogTravelCost;

  return {
    tier,
    kennelTravelCost,
    dogTravelCost,
    dogsTraveling,
    totalCost,
  };
}

export function calculateTripTravelCost(
  homeDistrict: number,
  showDistrict: number,
  dogsTraveling: number
): number {
  return getTravelCostBreakdown(
    homeDistrict,
    showDistrict,
    dogsTraveling
  ).totalCost;
}

export function calculateBaseTravelCost(
  homeDistrict: number,
  showDistrict: number
): number {
  return getTravelCostBreakdown(
    homeDistrict,
    showDistrict,
    0
  ).kennelTravelCost;
}