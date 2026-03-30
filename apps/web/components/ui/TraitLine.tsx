type TraitLineProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  ideal?: number;
  leftLabel?: string;
  rightLabel?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDeviationColor(value: number, ideal: number): string {
  const distance = Math.abs(value - ideal);

  if (distance <= 0.5) return "#22c55e"; // bright green = ideal
  if (distance <= 2) return "#84cc16";   // green-yellow
  if (distance <= 4) return "#eab308";   // yellow
  if (distance <= 6) return "#f97316";   // orange
  return "#dc2626";                      // red
}

export default function TraitLine({
  label,
  value,
  min = 0,
  max = 20,
  ideal = 10,
  leftLabel = "Weak",
  rightLabel = "Strong",
}: TraitLineProps) {
  const safeValue = clamp(value, min, max);
  const safeIdeal = clamp(ideal, min, max);

  const valuePercent = ((safeValue - min) / (max - min)) * 100;
  const idealPercent = ((safeIdeal - min) / (max - min)) * 100;
  const markerColor = getDeviationColor(safeValue, safeIdeal);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="text-purple-100/85">{label}</span>
        <span className="font-semibold text-white">{safeValue.toFixed(1)}</span>
      </div>

      <div className="relative mt-2 h-6">
        {/* baseline line */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 rounded bg-white/20" />

        {/* ideal tick */}
        <div
          className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded bg-emerald-300/80"
          style={{ left: `${idealPercent}%` }}
        />

        {/* value marker */}
        <div
          className="absolute top-1/2 h-5 w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-sm shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
          style={{
            left: `${valuePercent}%`,
            backgroundColor: markerColor,
          }}
          title={safeValue.toFixed(1)}
        />
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-purple-100/50">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
