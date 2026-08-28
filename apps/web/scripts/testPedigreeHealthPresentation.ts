import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");
const pedigreeGrid = fs.readFileSync(
  path.join(repoRoot, "apps/web/components/dogs/DogPedigreeGrid.tsx"),
  "utf8"
);
const fullPedigreeTree = fs.readFileSync(
  path.join(repoRoot, "apps/web/components/dogs/DogFullPedigreeTree.tsx"),
  "utf8"
);

for (const [name, source] of [
  ["pedigree grid", pedigreeGrid],
  ["full pedigree tree", fullPedigreeTree],
] as const) {
  assert.match(
    source,
    /import \{ PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES \} from "\.\/phenotypeHealthPresentation"/,
    `${name} reuses the shared phenotype health presentation helper`
  );
  assert.match(
    source,
    /<span>\{(?:result|result)\.displayName\}: <\/span>[\s\S]*?PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES\[(?:result|result)\.severityKey\][\s\S]*?\{(?:result|result)\.resultLabel\}/,
    `${name} keeps the label neutral and applies the severity class only to the result value`
  );
  assert.equal(
    source.includes("getPhenotypeHealthSeverity"),
    false,
    `${name} uses the pedigree DTO severityKey without recalculating severity`
  );
  assert.match(
    source,
    /Full health clearance/,
    `${name} preserves full health clearance presentation`
  );
}

assert.match(
  pedigreeGrid,
  /function healthToneClass[\s\S]*?ancestor\.healthStatusMarkers\.badgeStatus/,
  "pedigree grid preserves its aggregate ancestor-card tint"
);

console.log("Pedigree health-result presentation checks passed.");
