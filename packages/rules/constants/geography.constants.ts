
/**
 * DistanceTier represents the relative travel distance between two districts.
 *
 * These values are NOT miles or kilometers. They are abstract tiers used
 * by the economy engine to determine travel costs, fatigue, etc.
 *
 * Lower number = closer districts
 * Higher number = farther travel
 *
 * These tiers correspond to the DISTRICT_DISTANCE_MATRIX values.
 */
export enum DistanceTier {
  Home = 0,          // Same district
  Nearby = 1,        // Adjacent district
  Neighboring = 2,   // Short regional travel
  Regional = 3,      // Moderate travel
  Far = 4,           // Cross-country style travel
  LongDistance = 5,  // Very long travel
  Remote = 6,        // Difficult travel areas
  Isolated = 7       // Extreme travel (AK / HI / PR type cases)
}

/**
 * Human-readable labels for each DistanceTier.
 *
 * These are intended for UI display only.
 * Example:
 *
 *   Travel Tier: Regional
 *
 * The economy engine should NOT rely on these strings for logic.
 * Always use the numeric DistanceTier values for calculations.
 */
export const DISTANCE_TIER_LABEL: Record<DistanceTier, string> = {
  [DistanceTier.Home]: "Home",
  [DistanceTier.Nearby]: "Nearby",
  [DistanceTier.Neighboring]: "Neighboring",
  [DistanceTier.Regional]: "Regional",
  [DistanceTier.Far]: "Far",
  [DistanceTier.LongDistance]: "Long Distance",
  [DistanceTier.Remote]: "Remote",
  [DistanceTier.Isolated]: "Isolated"
};

export type ShowDistrictRegion = {
  district: number;
  name: string;
  shortName: string;
};

export const SHOW_DISTRICT_REGIONS: ShowDistrictRegion[] = [
  { district: 1, name: "Pacific Northwest", shortName: "Cascadia" },
  { district: 2, name: "Northern California", shortName: "NorCal" },
  { district: 3, name: "Southern California", shortName: "SoCal" },
  { district: 4, name: "Mountain West", shortName: "Mountain West" },
  { district: 5, name: "Desert Southwest", shortName: "Desert Southwest" },
  { district: 6, name: "Texas Plains", shortName: "Texas Plains" },
  { district: 7, name: "Great Plains", shortName: "Great Plains" },
  { district: 8, name: "Upper Midwest", shortName: "Upper Midwest" },
  { district: 9, name: "Great Lakes", shortName: "Great Lakes" },
  { district: 10, name: "Ohio Valley", shortName: "Ohio Valley" },
  { district: 11, name: "Mid-Atlantic", shortName: "Mid-Atlantic" },
  { district: 12, name: "Northeast", shortName: "Northeast" },
  { district: 13, name: "Southeast", shortName: "Southeast" },
  { district: 14, name: "Gulf Coast", shortName: "Gulf Coast" },
  { district: 15, name: "Florida-Caribbean", shortName: "Florida Coast" },
];

/**
 * DISTRICT_DISTANCE_MATRIX
 *
 * 15 × 15 matrix defining travel distance tiers between districts.
 *
 * Row = origin district
 * Column = destination district
 *
 * IMPORTANT:
 * District numbers in the game are 1-based (1–15),
 * but arrays in TypeScript are 0-based.
 *
 * Therefore:
 *
 *   districtIndex = districtNumber - 1
 *
 * Example:
 *
 *   District 1 → District 4
 *
 *   matrix[0][3]
 *
 * This matrix MUST remain symmetrical:
 *
 *   distance(A,B) == distance(B,A)
 *
 * Diagonal must always be 0 because travel within the same district
 * does not incur inter-district travel cost.
 *
 * The geography helper functions should be used to access this matrix
 * instead of reading it directly elsewhere in the codebase.
 */
export const DISTRICT_DISTANCE_MATRIX: number[][] = [
  [0,1,1,2,2,3,3,4,4,5,5,6,6,7,7],
  [1,0,1,1,2,2,3,3,4,4,5,5,6,6,7],
  [1,1,0,1,1,2,2,3,3,4,4,5,5,6,6],
  [2,1,1,0,1,1,2,2,3,3,4,4,5,5,6],
  [2,2,1,1,0,1,1,2,2,3,3,4,4,5,5],
  [3,2,2,1,1,0,1,1,2,2,3,3,4,4,5],
  [3,3,2,2,1,1,0,1,1,2,2,3,3,4,4],
  [4,3,3,2,2,1,1,0,1,1,2,2,3,3,4],
  [4,4,3,3,2,2,1,1,0,1,1,2,2,3,3],
  [5,4,4,3,3,2,2,1,1,0,1,1,2,2,3],
  [5,5,4,4,3,3,2,2,1,1,0,1,1,2,2],
  [6,5,5,4,4,3,3,2,2,1,1,0,1,1,2],
  [6,6,5,5,4,4,3,3,2,2,1,1,0,1,1],
  [7,6,6,5,5,4,4,3,3,2,2,1,1,0,1],
  [7,7,6,6,5,5,4,4,3,3,2,2,1,1,0]
];
