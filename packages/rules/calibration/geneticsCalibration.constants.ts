/**
 * GEN-06E CALIBRATION values. These describe reset-population simulation
 * inputs only; they are not imported by production foundation or puppy flows.
 */
export const FINAL_GENETICS_CALIBRATION = {
  founderDistribution: { family: "NORMAL_LIKE", spread: 14 },
  mutation: { probability: 0.001, effectMagnitude: 0.005 },
  breedBackgroundCoefficient: 0,
} as const;

/**
 * Expected scheduled-growth NORMAL_SELECTION population-MAD guidance from the
 * GEN-06E matched-seed evidence. These are monitoring bands, never runtime
 * inheritance rules or quality caps.
 */
export const FINAL_GENETICS_CHECKPOINT_BANDS = {
  G0: [5.5, 6.8],
  G3: [5.1, 6.1],
  G10: [3.0, 5.6],
  G20: [1.8, 4.3],
  G50: [1.2, 2.4],
  G100: [1.2, 2.4],
  G200: [1.2, 2.4],
} as const;
