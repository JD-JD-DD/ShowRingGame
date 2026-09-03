import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import CommunityAuthor from "../components/community/CommunityAuthor";

const root = join(process.cwd(), "../..");
const authorSource = readFileSync(
  join(root, "apps/web/components/community/CommunityAuthor.tsx"),
  "utf8"
);

const sharedProps = {
  kennel: { id: "other-kennel", name: "Northwind Kennel", slug: "northwind" },
  badges: { prestigeScore: 42, prestigeRank: "Hallmark" },
  supporterTier: null,
  currentKennelId: "current-kennel",
};

const otherPlayerMarkup = renderToStaticMarkup(
  <CommunityAuthor {...sharedProps} sourceType="PLAYER" />
);
assert.match(otherPlayerMarkup, />Message Player<\/a>/);
assert.match(otherPlayerMarkup, /href="\/inbox\/messages\/start\/northwind"/);

const ownPlayerMarkup = renderToStaticMarkup(
  <CommunityAuthor
    {...sharedProps}
    kennel={{ ...sharedProps.kennel, id: "current-kennel" }}
    sourceType="PLAYER"
  />
);
assert.doesNotMatch(ownPlayerMarkup, /Message Player/);

const systemMarkup = renderToStaticMarkup(
  <CommunityAuthor {...sharedProps} sourceType="SYSTEM" />
);
assert.doesNotMatch(systemMarkup, /Message Player/);

assert.doesNotMatch(authorSource, /kennelMessaging\.service/);
assert.doesNotMatch(authorSource, /getKennelMessagingBlockState|findKennelConversation|getOrCreateKennelConversation/);

console.log("Community Message Player entry-point checks passed.");
