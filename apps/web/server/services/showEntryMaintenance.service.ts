// Temporary operational switch. Set this to false after the calendar and
// judge-assignment repairs are complete to restore every player entry path.
export const SHOW_ENTRY_MAINTENANCE_ACTIVE = true;

export const SHOW_ENTRY_MAINTENANCE_MESSAGE =
  "Show entry is temporarily paused while the show calendar and judge assignments are being updated. Existing entries and show results are not affected. Entry access will return after the maintenance is complete.";

export function isShowEntryMaintenanceActive(): boolean {
  return SHOW_ENTRY_MAINTENANCE_ACTIVE;
}

export function assertShowEntryMaintenanceAllowsSubmission(): void {
  if (isShowEntryMaintenanceActive()) {
    throw new Error(SHOW_ENTRY_MAINTENANCE_MESSAGE);
  }
}
