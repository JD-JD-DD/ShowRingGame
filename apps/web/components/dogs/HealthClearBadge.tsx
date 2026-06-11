import type { PhenotypeHealthBadgeStatus } from "@/lib/dogHealth";

type HealthClearBadgeProps = {
  status?: PhenotypeHealthBadgeStatus;
  fullClearance?: boolean;
  size?: "sm" | "lg";
};

const SIZE_STYLES = {
  sm: "h-5 w-5 text-xs",
  lg: "h-8 w-8 text-xl sm:h-9 sm:w-9",
};

const DOT_SIZE_STYLES = {
  sm: "h-2.5 w-2.5",
  lg: "h-4 w-4",
};

const STATUS_STYLES: Record<PhenotypeHealthBadgeStatus, string> = {
  green: "border-emerald-300/60 bg-emerald-500/20 text-emerald-200",
  yellow: "border-amber-300/60 bg-amber-500/20 text-amber-100",
  red: "border-red-300/70 bg-red-500/20 text-red-100",
};

const DOT_STYLES: Record<PhenotypeHealthBadgeStatus, string> = {
  green: "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.45)]",
  yellow: "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.45)]",
  red: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]",
};

const STATUS_LABELS: Record<PhenotypeHealthBadgeStatus, string> = {
  green: "Completed phenotype health tests are green",
  yellow: "Yellow phenotype health test result present",
  red: "Red phenotype health test result present",
};

export default function HealthClearBadge({
  status = "green",
  fullClearance = false,
  size = "sm",
}: HealthClearBadgeProps) {
  const label =
    status === "green" && fullClearance
      ? "All four phenotype health tests completed with green results"
      : STATUS_LABELS[status];

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-extrabold ${
        status === "green" && fullClearance
          ? "border-white bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.45),0_0_14px_rgba(255,255,255,0.28)]"
          : STATUS_STYLES[status]
      } ${SIZE_STYLES[size]}`}
    >
      {status === "green" && fullClearance ? (
        <>&#10003;</>
      ) : (
        <span
          aria-hidden="true"
          className={`rounded-full ${DOT_STYLES[status]} ${DOT_SIZE_STYLES[size]}`}
        />
      )}
    </span>
  );
}
