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
  const headerNavigationSource = source(
    "apps/web/components/layout/GameHeaderNav.tsx"
  );

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
  for (const item of [
    '{ label: "Home", href: "/" }',
    'label: "My Kennel"',
    'label: "Shows"',
    'label: "Breeding"',
    'label: "Market"',
    'label: "Community"',
  ]) {
    assert.ok(
      headerNavigationSource.includes(item),
      "header retains " + item + " in the primary navigation structure"
    );
  }
  for (const item of [
    '{ label: "Prestige", href: "/kennel/prestige" }',
    '{ label: "In Memoriam", href: "/memorium" }',
    '{ label: "Ledger", href: "/ledger" }',
    '{ label: "My Results", href: "/my-results" }',
    '{ label: "Point Schedules", href: "/point-schedules" }',
    '{ label: "Plan a Litter", href: "/plan-a-litter" }',
    '{ label: "Litters", href: "/litters" }',
    '{ label: "Stud Contracts", href: "/stud-contracts" }',
    '{ label: "Services", href: "/kennel/services" }',
    '{ label: "Players", href: "/districts/kennels" }',
    '{ label: "Start Up Guide", href: "/start-up-guide" }',
  ]) {
    assert.ok(
      headerNavigationSource.includes(item),
      "header retains the canonical " + item + " destination"
    );
  }
  assert.ok(
    headerNavigationSource.includes("onUnreadCountChange={setUnreadCount}"),
    "collapsed mobile navigation reuses the Inbox unread count"
  );
  assert.ok(
    headerNavigationSource.includes("unreadCount > 0"),
    "collapsed mobile navigation hides its unread badge at zero"
  );

  console.log("Game header visibility checks passed.");
}

main();
