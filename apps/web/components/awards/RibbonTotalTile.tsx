type RibbonTotalTileProps = {
  label: string;
  count: number;
  assetPath: string;
  alt: string;
};

export function RibbonTotalTile({
  label,
  count,
  assetPath,
  alt,
}: RibbonTotalTileProps) {
  const subdued = count === 0;
  const isTopTier = label === "BIS" || label === "RBIS";
  const isGroup = label.startsWith("G");
  const isBreed = label === "BOB" || label === "BOS" || label === "SELECT";

  return (
    <div
      className={`flex h-full flex-col items-center rounded-[22px] border px-3 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
        subdued
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(4,9,20,0.32))]"
          : isTopTier
            ? "border-amber-300/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(74,38,10,0.12),rgba(7,11,28,0.44))]"
            : isGroup
              ? "border-sky-300/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(12,26,54,0.14),rgba(7,11,28,0.42))]"
              : isBreed
                ? "border-fuchsia-300/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(56,18,68,0.14),rgba(7,11,28,0.42))]"
                : "border-[var(--dog-border)] bg-white/5"
      }`}
    >
      <div className="flex min-h-[9.5rem] w-full items-center justify-center rounded-[18px] bg-black/15 px-2">
        <img
          src={assetPath}
          alt={alt}
          className={`h-32 w-full object-contain ${subdued ? "opacity-55 saturate-75" : ""}`}
        />
      </div>
      <div className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight ${
          subdued ? "text-[var(--dog-copy)]" : "text-white"
        }`}
      >
        {count}
      </div>
    </div>
  );
}
