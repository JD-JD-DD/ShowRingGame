/** Player-facing presentation only; genetic category values remain directional 0–20 numbers. */
export function formatGeneticCategoryValue(value: number): string {
  return value.toFixed(3);
}
