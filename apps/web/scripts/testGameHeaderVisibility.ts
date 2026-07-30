import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`)
    ? join(cwd, "..", "..")
    : cwd;

  return readFileSync(join(root, path), "utf8");
}

function main() {
  const visibilitySource = source(
    "apps/web/components/layout/GameHeaderVisibility.tsx"
  );
  const rootLayoutSource = source("apps/web/app/layout.tsx");

  assert.ok(
    visibilitySource.includes('"/signup", "/login", "/onboarding"'),
    "header visibility excludes exactly the account and onboarding routes"
  );
  assert.ok(
    visibilitySource.includes("HIDDEN_HEADER_PATHNAMES.has(pathname)"),
    "header visibility uses exact pathname matching"
  );
  assert.ok(
    visibilitySource.includes("return null"),
    "hidden routes render no header landmark or controls"
  );
  assert.ok(
    rootLayoutSource.includes("<GameHeaderVisibility>"),
    "root layout wraps the existing header with route-aware visibility"
  );
  assert.ok(
    rootLayoutSource.includes("<GameHeader />"),
    "root layout preserves the existing server-rendered header"
  );

  console.log("Game header visibility checks passed.");
}

main();
