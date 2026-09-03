import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import CommunityAuthor from "../components/community/CommunityAuthor";

const root = join(process.cwd(), "../..");
const bulletin = readFileSync(
  join(root, "apps/web/server/services/bulletin.service.ts"),
  "utf8"
);
const author = readFileSync(
  join(root, "apps/web/components/community/CommunityAuthor.tsx"),
  "utf8"
);
const prestige = readFileSync(
  join(root, "apps/web/components/bulletin/BulletinBadges.tsx"),
  "utf8"
);

for (const tier of ["BRONZE", "SILVER", "GOLD"] as const) {
  const markup = renderToStaticMarkup(
    <CommunityAuthor
      kennel={{ id: "northwind", name: "Northwind Kennel", slug: "northwind" }}
      badges={{ prestigeScore: 42, prestigeRank: "Hallmark" }}
      supporterTier={tier}
      currentKennelId="other-kennel"
      sourceType="PLAYER"
    />
  );
  assert.match(markup, /Hallmark/);
  assert.match(markup, /href="\/kennels\/northwind"/);
  assert.match(markup, /href="\/support"/);
  assert.match(markup, new RegExp(`${tier[0]}${tier.slice(1).toLowerCase()} Supporter`));
  assert.ok(markup.indexOf("</a>") < markup.lastIndexOf('href="/support"'));
}

const hiddenMarkup = renderToStaticMarkup(
  <CommunityAuthor
    kennel={{ id: "northwind", name: "Northwind Kennel", slug: "northwind" }}
    badges={{ prestigeScore: 42, prestigeRank: "Hallmark" }}
    supporterTier={null}
    currentKennelId="other-kennel"
    sourceType="PLAYER"
  />
);
assert.match(hiddenMarkup, /Hallmark/);
assert.doesNotMatch(hiddenMarkup, /href="\/support"/);

assert.match(bulletin, /getCommunitySupporterBadgePresentations/);
assert.match(bulletin, /userId: true/);
assert.match(bulletin, /supporterTier: SupportPresentationTierValue \| null/);
assert.match(bulletin, /supporterTier: thread\.kennel\.userId/);
assert.match(bulletin, /supporterTier: post\.kennel\.userId/);
assert.match(bulletin, /badgesForKennels\(authorKennelIds\)/);
assert.match(bulletin, /thread\.kennel\.userId,\s*\.\.\.thread\.posts\.map/);
assert.equal(
  (bulletin.match(/getCommunitySupporterBadgePresentations\(/g) ?? []).length,
  3
);
assert.match(author, /<BulletinBadges badges=\{badges\} \/>/);
assert.match(author, /supporterTier \? <SupporterBadge tier=\{supporterTier\} \/>/);
assert.match(author, /href=\{`\/kennels\/\$\{kennel\.slug\}`\}/);
assert.match(author, /<SupporterBadge/);
assert.ok(author.indexOf("</Link>") < author.indexOf("<SupporterBadge"));
assert.doesNotMatch(author, /providerSubscriptionId|providerPlanId|billingAmount|currentPaidPeriodEnd|SupportSubscriptionChange|userId/);
assert.doesNotMatch(bulletin, /orderBy:\s*\{[^}]*supporter/i);
assert.match(prestige, /prestigeRank/);

console.log("SUPPORT-08A-2B community supporter identity checks passed.");
