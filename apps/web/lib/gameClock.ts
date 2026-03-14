/**
 * Game clock helper
 *
 * The simulation runs on integer epoch hours.
 * 1 game hour = 1 real day.
 *
 * Epoch 0 = the moment the game world was launched.
 */

const GAME_EPOCH_START = new Date("2026-01-01T00:00:00Z").getTime();

/**
 * Returns the current game epoch hour.
 */
export function getCurrentEpoch(): number {
  const now = Date.now();
  const elapsedMs = now - GAME_EPOCH_START;

  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));

  return Math.max(0, hours);
}

/**
 * Converts epoch hours back into real time
 * (useful for debugging or admin tools)
 */
export function epochToDate(epoch: number): Date {
  return new Date(GAME_EPOCH_START + epoch * 60 * 60 * 1000);
}
