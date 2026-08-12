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
  green: "border-[#0F5F2A] bg-[#23f707]",
  yellow: "border-[#A68300] bg-[#faf605]",
  red: "border-[#8E1D1D] bg-[#f70707]",
};

const DOT_STYLES: Record<PhenotypeHealthBadgeStatus, string> = {
  green: "bg-[#23f707]",
  yellow: "bg-[#faf605]",
  red: "bg-[#f70707]",
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
      ? "All required health tests completed with green results"
      : STATUS_LABELS[status];

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-extrabold ${
        status === "green" && fullClearance
          ? "border-[#0F5F2A] bg-[#23f707] text-[#ffffff] shadow-[var(--shadow-soft)]"
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
