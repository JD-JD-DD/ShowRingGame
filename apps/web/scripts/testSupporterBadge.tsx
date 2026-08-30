import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import SupporterBadge from "../components/support/SupporterBadge";

for (const [tier, label] of [["BRONZE", "Bronze Supporter"], ["SILVER", "Silver Supporter"], ["GOLD", "Gold Supporter"]] as const) {
  const markup = renderToStaticMarkup(<SupporterBadge tier={tier} />);
  assert.match(markup, /Supporter/); assert.match(markup, /href="\/support"/); assert.match(markup, new RegExp(`aria-label="${label}"`)); assert.match(markup, /focus-visible/);
}
console.log("SUPPORT-07A supporter badge checks passed.");
