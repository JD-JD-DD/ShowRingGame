
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
  /**
   * Permanent player-facing district color. This is an identity color, not a
   * travel-distance color, so players can recognize their region consistently.
   */
  accentColor: string;
};

export const SHOW_DISTRICT_REGIONS: ShowDistrictRegion[] = [
  { district: 1, name: "Pacific Northwest", shortName: "Cascadia", accentColor: "#38bdf8" },
  { district: 2, name: "Northern California", shortName: "NorCal", accentColor: "#60a5fa" },
  { district: 3, name: "Southern California", shortName: "SoCal", accentColor: "#818cf8" },
  { district: 4, name: "Mountain West", shortName: "Mountain West", accentColor: "#a78bfa" },
  { district: 5, name: "Desert Southwest", shortName: "Desert Southwest", accentColor: "#f59e0b" },
  { district: 6, name: "Texas Plains", shortName: "Texas Plains", accentColor: "#f97316" },
  { district: 7, name: "Great Plains", shortName: "Great Plains", accentColor: "#84cc16" },
  { district: 8, name: "Upper Midwest", shortName: "Upper Midwest", accentColor: "#22c55e" },
  { district: 9, name: "Great Lakes", shortName: "Great Lakes", accentColor: "#14b8a6" },
  { district: 10, name: "Ohio Valley", shortName: "Ohio Valley", accentColor: "#06b6d4" },
  { district: 11, name: "Mid-Atlantic", shortName: "Mid-Atlantic", accentColor: "#6366f1" },
  { district: 12, name: "Northeast", shortName: "Northeast", accentColor: "#a855f7" },
  { district: 13, name: "Southeast", shortName: "Southeast", accentColor: "#ec4899" },
  { district: 14, name: "Gulf Coast", shortName: "Gulf Coast", accentColor: "#f43f5e" },
  { district: 15, name: "Florida-Caribbean", shortName: "Florida Coast", accentColor: "#fb7185" },
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
