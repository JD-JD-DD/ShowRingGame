type TraitLineProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  ideal?: number;
  leftLabel?: string;
  centerLabel?: string;
  rightLabel?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDeviationColor(value: number, ideal: number): string {
  const distance = Math.abs(value - ideal);

  if (distance <= 0.5) return "#23f707"; // bright green = ideal
  if (distance <= 2) return "#a8f707";   // bright lime
  if (distance <= 4) return "#faf605";   // bright yellow
  if (distance <= 6) return "#ff8a00";   // bright orange
  return "#f70707";                      // bright red
}

export default function TraitLine({
  label,
  value,
  min = 0,
  max = 20,
  ideal = 10,
  leftLabel = "Under ideal",
  centerLabel = "10 ideal",
  rightLabel = "Over ideal",
}: TraitLineProps) {
  const safeValue = clamp(value, min, max);
  const safeIdeal = clamp(ideal, min, max);

  const valuePercent = ((safeValue - min) / (max - min)) * 100;
  const idealPercent = ((safeIdeal - min) / (max - min)) * 100;
  const markerColor = getDeviationColor(safeValue, safeIdeal);

  return (
    <div>
      <div className="mb-1 text-sm">
        <span className="dog-copy">{label} </span>
        <span className="dog-heading font-semibold">{safeValue.toFixed(1)}</span>
    </div>

      <div className="relative mt-2 h-6">
        {/* baseline line */}
        <div className="dog-trait-track absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 rounded" />

        {/* ideal tick */}
        <div
          className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded bg-[#23f707]"
          style={{ left: `${idealPercent}%` }}
        />

        {/* value marker */}
        <div
          className="dog-trait-marker absolute top-1/2 h-5 w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-sm"
          style={{
            left: `${valuePercent}%`,
            backgroundColor: markerColor,
          }}
          title={safeValue.toFixed(1)}
        />
      </div>

      <div className="dog-copy mt-1 flex items-center justify-between text-[11px] uppercase tracking-wide">
        <span>{leftLabel}</span>
        <span className="text-[#23f707]">{centerLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
