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

function assertIncludes(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), label);
}

function assertExcludes(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), label);
}

function main() {
  const headerSource = source("apps/web/components/layout/GameHeaderNav.tsx");
  const logoutButtonSource = source("apps/web/components/LogoutButton.tsx");
  const logoutRouteSource = source("apps/web/app/api/auth/logout/route.ts");
  const sessionSource = source("apps/web/lib/session.ts");

  assertIncludes(
    headerSource,
    "<LogoutButton />",
    "global header account menu renders the logout control"
  );
  assertExcludes(
    headerSource,
    "onClickCapture={() => setAccountOpen(false)}",
    "logout submit is not raced by menu click-capture closing"
  );

  assertIncludes(
    logoutButtonSource,
    'action="/api/auth/logout"',
    "logout control posts to the logout route"
  );
  assertIncludes(
    logoutButtonSource,
    'method="post"',
    "logout control uses POST"
  );
  assertIncludes(
    logoutButtonSource,
    'type="submit"',
    "logout control submits the form"
  );
  assertExcludes(
    logoutButtonSource,
    "fetch(",
    "logout control does not rely on a client fetch"
  );
  assertExcludes(
    logoutButtonSource,
    "useRouter",
    "logout control does not rely on soft app-router navigation"
  );

  assertIncludes(
    logoutRouteSource,
    "clearSession",
    "logout route clears the existing session"
  );
  assertIncludes(
    logoutRouteSource,
    "NextResponse.redirect",
    "logout route redirects browser form submissions"
  );
  assertIncludes(
    logoutRouteSource,
    "303",
    "logout route redirects POST submissions with See Other"
  );
  assertIncludes(
    logoutRouteSource,
    "nextPath: LOGOUT_REDIRECT_PATH",
    "logout route preserves JSON response shape for API callers"
  );

  assertIncludes(
    sessionSource,
    "SESSION_COOKIE_NAME, \"\"",
    "clearSession expires the session cookie value"
  );
  assertIncludes(
    sessionSource,
    "maxAge: 0",
    "clearSession expires the cookie immediately"
  );
  assertIncludes(
    sessionSource,
    'path: "/"',
    "clearSession targets the same cookie path as createSession"
  );

  console.log("Global header logout checks passed.");
}

main();
