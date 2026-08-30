// @ts-expect-error @next/env is used by the existing provisioning script but has no local declaration file.
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createPayPalSandboxClient,
  PayPalSupportError,
} from "../server/services/paypalSupport.service";

loadEnvConfig(process.cwd());

const statePath = join(process.cwd(), "artifacts", "support-06a2-sandbox.json");
const returnUrl = "https://show-ring-game.vercel.app/support";
const cancelUrl = "https://show-ring-game.vercel.app/support?paypal=cancelled";

type State = { bronzeId?: string; silverId?: string };

function readState(): State {
  return existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) as State : {};
}

function saveState(state: State) {
  mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state), "utf8");
}

function output(value: unknown) {
  console.log(JSON.stringify(value));
}

async function main() {
  const action = process.argv[2];
  const state = readState();
  const client = createPayPalSandboxClient();

  if (action === "create-bronze") {
    if (state.bronzeId) throw new Error("A Bronze validation subscription is already recorded.");
    const created = await client.createSubscription({ tier: "BRONZE", returnUrl, cancelUrl });
    saveState({ bronzeId: created.providerSubscriptionId });
    output({ subscriptionId: created.providerSubscriptionId, status: "APPROVAL_PENDING", approvalUrl: created.approvalUrl });
    return;
  }

  if (action === "get-bronze") {
    if (!state.bronzeId) throw new Error("No Bronze validation subscription is recorded.");
    const bronze = await client.getSubscription(state.bronzeId);
    output({ subscriptionId: bronze.id, status: bronze.status, planId: bronze.planId, nextBillingTime: bronze.nextBillingTime?.toISOString() ?? null });
    return;
  }

  if (action === "create-silver") {
    if (!state.bronzeId || state.silverId) throw new Error("Bronze must be recorded and Silver must not already be recorded.");
    const bronze = await client.getSubscription(state.bronzeId);
    if (bronze.status !== "ACTIVE") throw new Error("Bronze must be ACTIVE before creating Silver.");
    const created = await client.createSubscription({ tier: "SILVER", returnUrl, cancelUrl });
    saveState({ ...state, silverId: created.providerSubscriptionId });
    output({ subscriptionId: created.providerSubscriptionId, status: "APPROVAL_PENDING", approvalUrl: created.approvalUrl, bronzeStatus: bronze.status });
    return;
  }

  if (action === "get-both") {
    if (!state.bronzeId || !state.silverId) throw new Error("Both Bronze and Silver validation subscriptions are required.");
    const [bronze, silver] = await Promise.all([client.getSubscription(state.bronzeId), client.getSubscription(state.silverId)]);
    output({
      bronze: { subscriptionId: bronze.id, status: bronze.status, planId: bronze.planId, nextBillingTime: bronze.nextBillingTime?.toISOString() ?? null },
      silver: { subscriptionId: silver.id, status: silver.status, planId: silver.planId, nextBillingTime: silver.nextBillingTime?.toISOString() ?? null },
    });
    return;
  }

  if (action === "cancel-bronze") {
    if (!state.bronzeId || !state.silverId) throw new Error("Both Bronze and Silver validation subscriptions are required.");
    const [bronze, silver] = await Promise.all([client.getSubscription(state.bronzeId), client.getSubscription(state.silverId)]);
    if (bronze.status !== "ACTIVE" || silver.status !== "ACTIVE") throw new Error("Both validation subscriptions must be ACTIVE before Bronze cancellation.");
    await client.cancelSubscription(state.bronzeId);
    const [cancelledBronze, currentSilver] = await Promise.all([client.getSubscription(state.bronzeId), client.getSubscription(state.silverId)]);
    output({
      bronze: { subscriptionId: cancelledBronze.id, status: cancelledBronze.status },
      silver: { subscriptionId: currentSilver.id, status: currentSilver.status, planId: currentSilver.planId },
    });
    return;
  }

  throw new Error("Usage: testPayPalSandboxReplacement.cts <create-bronze|get-bronze|create-silver|get-both|cancel-bronze>");
}

main().catch((error) => {
  console.error(error instanceof PayPalSupportError ? error.message : error instanceof Error ? error.message : "Sandbox validation failed.");
  process.exitCode = 1;
});
