type HealthClearBadgeProps = {
  size?: "sm" | "lg";
};

const SIZE_STYLES = {
  sm: "h-5 w-5 text-xs",
  lg: "h-8 w-8 text-xl sm:h-9 sm:w-9",
};

export default function HealthClearBadge({
  size = "sm",
}: HealthClearBadgeProps) {
  return (
    <span
      title="All four phenotype health tests completed with green results"
      aria-label="All four phenotype health tests completed with green results"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-500/20 font-extrabold text-emerald-200 ${SIZE_STYLES[size]}`}
    >
      &#10003;
    </span>
  );
}
