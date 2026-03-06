// tier system definition
export enum DistanceTier {
  Home = 0,
  Nearby = 1,
  Neighboring = 2,
  Regional = 3,
  Far = 4,
  LongDistance = 5,
  Remote = 6,
  Isolated = 7
}

// define labels
export const DISTANCE_TIER_LABEL: Record<DistanceTier, string> = {
  [DistanceTier.Home]: "Home",
  [DistanceTier.Nearby]: "Nearby",
  [DistanceTier.Neighboring]: "Neighboring",
  [DistanceTier.Regional]: "Regional",
  [DistanceTier.Far]: "Far",
  [DistanceTier.LongDistance]: "LongDistance",
  [DistanceTier.Remote]: "Remote",
  [DistanceTier.Isolated]: "Isolated"
};

// 2D array; district 1 = index 0
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