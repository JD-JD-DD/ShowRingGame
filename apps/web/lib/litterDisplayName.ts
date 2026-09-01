export function getLitterDisplayName(
  customName: string | null,
  serial7: string
): string {
  return customName && customName.trim() ? customName : `Serial ${serial7}`;
}
