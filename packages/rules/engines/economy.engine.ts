/**
 * ECONOMY ENGINE
 *
 * This file contains gameplay calculations related to the game's economy.
 * It does NOT store raw values.
 *
 * Responsibilities of this engine:
 *
 * - Calculate kennel travel costs
 * - Calculate per-dog travel costs
 * - Provide travel cost breakdowns for UI and planning tools
 *
 * The economy engine combines:
 *
 *   geography rules  +  economy constants
 *
 * Example flow:
 *
 *   district → distance tier → travel cost
 */

import { BASE_TRAVEL_COST, TRAVEL_COST_PER_DOG } from "../constants/economy.constants";
import { DistanceTier } from "../constants/geography.constants";
import { getDistrictDistanceTier } from "../src/geography";


/**
 * TravelCostBreakdown
 *
 * Structured output describing how travel costs were calculated.
 *
 * This is returned instead of a single number so that:
 *
 * - the UI can display a breakdown of costs
 * - debugging becomes easier
 * - additional costs can be added later without breaking APIs
 *
 * Example output:
 *
 * {
 *   tier: 3,
 *   kennelTravelCost: 400,
 *   dogTravelCost: 150,
 *   dogsTraveling: 3,
 *   totalCost: 550
 * }
 */
export type TravelCostBreakdown = {

  /** Distance tier between the two districts */
  tier: DistanceTier;

  /** Base cost for the kennel to travel to the destination district */
  kennelTravelCost: number;

  /** Additional cost caused by transporting dogs */
  dogTravelCost: number;

  /** Number of dogs traveling with the kennel */
  dogsTraveling: number;

  /** Final total travel cost for the trip */
  totalCost: number;
};


/**
 * getTravelCostBreakdown
 *
 * Core travel cost calculator.
 *
 * This is the PRIMARY calculation function in this file.
 * Other helper functions should use this instead of duplicating logic.
 *
 * Steps:
 *
 * 1. Determine the distance tier between the two districts
 * 2. Look up the base travel cost for that tier
 * 3. Calculate additional per-dog travel cost
 * 4. Combine costs into a total
 *
 * NOTE:
 * The breakdown object allows the UI to show players how travel costs were calculated.
 */
export function getTravelCostBreakdown(
  homeDistrict: number,
  showDistrict: number,
  dogsTraveling: number
): TravelCostBreakdown {

  /**
   * Determine how far apart the districts are.
   *
   * This uses the DISTRICT_DISTANCE_MATRIX stored in geography.constants.ts
   */
  const tier = getDistrictDistanceTier(homeDistrict, showDistrict);

  /**
   * Base cost for the kennel to travel regardless of dog count.
   *
   * Example:
   * Driving the RV, flying the handler, hotel, etc.
   */
  const kennelTravelCost = BASE_TRAVEL_COST[tier];

  /**
   * Additional cost per dog transported.
   *
   * Example:
   * crates, grooming equipment, dog transport space, etc.
   */
  const dogTravelCost = dogsTraveling * TRAVEL_COST_PER_DOG;

  /**
   * Final total travel cost for the trip.
   */
  const totalCost = kennelTravelCost + dogTravelCost;

  return {
    tier,
    kennelTravelCost,
    dogTravelCost,
    dogsTraveling,
    totalCost,
  };
}


/**
 * calculateTripTravelCost
 *
 * Convenience helper returning ONLY the final travel cost.
 *
 * This function exists for cases where the caller only needs
 * the total cost and not the full breakdown.
 *
 * Internally it delegates to getTravelCostBreakdown so the
 * calculation logic stays in a single place.
 */
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


/**
 * calculateBaseTravelCost
 *
 * Returns ONLY the kennel travel cost for a district-to-district trip.
 *
 * This ignores dog transportation costs.
 *
 * Useful for:
 *
 * - estimating minimum travel costs
 * - calculating travel handler scenarios
 * - UI previews before dogs are selected
 */
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