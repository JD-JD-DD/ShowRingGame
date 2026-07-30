// Temporary operational switch. Set this to false after the calendar and
// judge-assignment repairs are complete to restore Year 15+ player entry.
export const SHOW_ENTRY_MAINTENANCE_ACTIVE = false;
export const SHOW_ENTRY_MAINTENANCE_START_YEAR = 15;

export const SHOW_ENTRY_MAINTENANCE_MESSAGE =
  "Show entry is temporarily paused while the show calendar and judge assignments are being updated. Existing entries and show results are not affected. Entry access will return after the maintenance is complete.";

export function isShowEntryMaintenanceActive(cluster: {
  year?: number | null;
}): boolean {
  return (
    SHOW_ENTRY_MAINTENANCE_ACTIVE &&
    (cluster.year ?? 0) >= SHOW_ENTRY_MAINTENANCE_START_YEAR
  );
}
