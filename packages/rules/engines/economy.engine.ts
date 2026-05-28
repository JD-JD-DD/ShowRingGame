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

import {
  BASE_TRAVEL_COST,
  TRAVEL_COST_PER_DOG,
  ENTRY_FEE_PER_SHOW,
  OWNER_HANDLED_DOG_LIMIT_PER_BREED,
  RINGSIDE_HANDLER_FEE
} from "../constants/economy.constants";
import { getDistrictDistanceTier } from "../src/geography";
import { DistanceTier } from "../constants/geography.constants";

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


/**
 * Represents one dog's current cluster selection from the UI.
 *
 * selectedShowDays is an array of day/show identifiers.
 * For v1, these can just be numbers.
 *
 * Example:
 * [1, 2, 4] means entered on days 1, 2, and 4 of the cluster.
 */
export type ClusterEntryDogSelection = {
  dogId: string;
  dogName: string;
  breed: string;
  sex: "Dog" | "Bitch";
  points?: number; // only relevant if not yet a champion
  selectedShowDays: number[];
};

/**
 * Full quote request built from the player's current UI selections.
 */
export type ClusterEntryQuoteInput = {
  homeDistrict: number;
  clusterDistrict: number;
  ledgerBalance: number;
  dogs: ClusterEntryDogSelection[];
  existingDogIdsByBreed?: Record<string, string[]>;
};

/**
 * Full quote returned to the UI for display and affordability checks.
 */
export type ClusterEntryQuote = {
  dogsEntered: number;
  totalEntries: number;

  travel: TravelCostBreakdown;
  entryFees: number;
  handlerDogs: number;
  handlerFee: number;

  totalCost: number;
  ledgerBalance: number;
  ledgerBalanceAfterEntry: number;
  shortfall: number;
  canAfford: boolean;
};

function getUniqueEnteredDogIdsByBreed(
  dogs: ClusterEntryDogSelection[]
): Map<string, Set<string>> {
  const dogIdsByBreed = new Map<string, Set<string>>();

  for (const dog of dogs) {
    if (dog.selectedShowDays.length === 0) {
      continue;
    }

    const dogIds = dogIdsByBreed.get(dog.breed) ?? new Set<string>();
    dogIds.add(dog.dogId);
    dogIdsByBreed.set(dog.breed, dogIds);
  }

  return dogIdsByBreed;
}

function getExistingDogIdsForBreed(
  existingDogIdsByBreed: Record<string, string[]> | undefined,
  breed: string
): Set<string> {
  return new Set(existingDogIdsByBreed?.[breed] ?? []);
}

function getRingsideHandlerDogs(input: ClusterEntryQuoteInput): number {
  const selectedDogIdsByBreed = getUniqueEnteredDogIdsByBreed(input.dogs);
  let handlerDogs = 0;

  for (const [breed, selectedDogIds] of selectedDogIdsByBreed.entries()) {
    const existingDogIds = getExistingDogIdsForBreed(
      input.existingDogIdsByBreed,
      breed
    );
    let newDogCount = 0;

    for (const dogId of selectedDogIds) {
      if (!existingDogIds.has(dogId)) {
        newDogCount += 1;
      }
    }

    const existingHandlerDogs = Math.max(
      0,
      existingDogIds.size - OWNER_HANDLED_DOG_LIMIT_PER_BREED
    );
    const totalHandlerDogs = Math.max(
      0,
      existingDogIds.size + newDogCount - OWNER_HANDLED_DOG_LIMIT_PER_BREED
    );

    handlerDogs += totalHandlerDogs - existingHandlerDogs;
  }

  return handlerDogs;
}


/**
 * Builds a live entry quote for the currently selected cluster entries.
 *
 * This function is intended to be called repeatedly by the UI whenever
 * the player checks or unchecks dogs or show days.
 *
 * It does NOT create entries or debit the ledger.
 * It only returns a quote.
 */
export function getClusterEntryQuote(
  input: ClusterEntryQuoteInput
): ClusterEntryQuote {
  /**
   * Only count dogs that actually have at least one selected show day.
   */
  const enteredDogs = input.dogs.filter(
    (dog) => dog.selectedShowDays.length > 0
  );

  /**
   * Number of unique dogs entered in the cluster.
   *
   * Used for:
   * - per-dog travel cost
   * - handler threshold logic
   */
  const dogsEntered = enteredDogs.length;

  /**
   * Total number of individual show entries across all selected dogs.
   *
   * Example:
   * - 2 dogs entered for 3 days each = 6 total entries
   */
  const totalEntries = enteredDogs.reduce(
    (sum, dog) => sum + dog.selectedShowDays.length,
    0
  );

  /**
   * Travel cost is based on unique dogs traveling, not number of show entries.
   */
  const travel = getTravelCostBreakdown(
    input.homeDistrict,
    input.clusterDistrict,
    dogsEntered
  );

  /**
   * Entry fees are charged per dog per selected show day.
   */
  const entryFees = totalEntries * ENTRY_FEE_PER_SHOW;

  /**
   * Ringside handler fees are calculated per breed at the primary show.
   * The kennel may owner-handle the first 3 dogs in each breed; each new dog
   * beyond that limit requires a ringside handler.
   */
  const handlerDogs = getRingsideHandlerDogs(input);
  const handlerFee = handlerDogs * RINGSIDE_HANDLER_FEE;

  /**
   * Final cost of this proposed cluster entry.
   */
  const totalCost = travel.totalCost + entryFees + handlerFee;

  /**
   * Ledger result after entry would be submitted.
   */
  const ledgerBalanceAfterEntry = input.ledgerBalance - totalCost;

  /**
   * Shortfall is useful for UI display if the player cannot afford the trip.
   */
  const shortfall = ledgerBalanceAfterEntry < 0
    ? Math.abs(ledgerBalanceAfterEntry)
    : 0;

  /**
   * Whether the player can successfully submit this entry.
   */
  const canAfford = ledgerBalanceAfterEntry >= 0;

  return {
    dogsEntered,
    totalEntries,
    travel,
    entryFees,
    handlerDogs,
    handlerFee,
    totalCost,
    ledgerBalance: input.ledgerBalance,
    ledgerBalanceAfterEntry,
    shortfall,
    canAfford,
  };
}
