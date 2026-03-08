import type { Judge } from "../engines/judge.engine";

export const sampleJudges: Judge[] = [
  {
    judgeId: "JUDGE-001",
    name: "Margaret Hale",
    style: "MOVEMENT_FOCUSED",
    categoryWeights: {
      TYPE_EXPRESSION: 0.91,
      STRUCTURE_BALANCE: 1.03,
      MOVEMENT: 1.18,
      COAT_PRESENTATION: 0.97,
      TEMPERAMENT_RING_BEHAVIOR: 1.01,
      CONDITIONING_HANDLING: 0.95,
    },
  },
];