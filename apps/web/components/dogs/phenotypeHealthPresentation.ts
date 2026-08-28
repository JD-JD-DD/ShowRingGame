import type { PhenotypeHealthSeverity } from "@/lib/dogHealth";

/** Presentation-only text treatment for the canonical phenotype health severity. */
export const PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES: Record<
  PhenotypeHealthSeverity,
  string
> = {
  green: "text-emerald-700 dark:text-emerald-200",
  yellow: "text-amber-700 dark:text-amber-200",
  red: "text-red-700 dark:text-red-200",
};
