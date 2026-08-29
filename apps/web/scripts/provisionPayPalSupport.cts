import { loadEnvConfig } from "@next/env";
import {
  createPayPalClient,
  getPayPalProvisioningConfig,
  PayPalSupportError,
  type PayPalEnvironment,
} from "../server/services/paypalSupport.service";

loadEnvConfig(process.cwd());

function requestedEnvironment(): PayPalEnvironment {
  const [argument] = process.argv.slice(2);
  if (process.argv.length !== 3 || !argument?.startsWith("--environment=")) {
    throw new Error("Usage: provisionPayPalSupport --environment=sandbox|live");
  }
  const environment = argument.slice("--environment=".length);
  if (environment !== "sandbox" && environment !== "live") {
    throw new Error("Provisioning requires --environment=sandbox or --environment=live.");
  }
  return environment;
}

const environment = requestedEnvironment();
const variablePrefix = `PAYPAL_${environment.toUpperCase()}`;
if (process.env[`${variablePrefix}_PRODUCT_ID`]?.trim()) {
  throw new Error(`${variablePrefix}_PRODUCT_ID is already configured; refusing to create another ${environment} product.`);
}

const client = createPayPalClient(getPayPalProvisioningConfig(environment));
const requestPrefix = `showring-support-${environment}-v1`;

function id(value: Record<string, unknown>, label: string): string {
  if (typeof value.id !== "string" || !value.id) throw new Error(`PayPal did not return a ${label} ID.`);
  return value.id;
}

function plan(tier: "bronze" | "silver" | "gold", name: string, amount: string, productId: string) {
  return client.createBillingPlan({ product_id: productId, name, description: "Voluntary recurring support for ShowRing Game development and operation.", billing_cycles: [{ tenure_type: "REGULAR", sequence: 1, total_cycles: 0, frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: { value: amount, currency_code: "USD" } } }], payment_preferences: { auto_bill_outstanding: true, setup_fee: { value: "0", currency_code: "USD" }, setup_fee_failure_action: "CONTINUE", payment_failure_threshold: 0 }, taxes: { percentage: "0", inclusive: false } }, `${requestPrefix}-plan-${tier}`);
}

function isVerifiedMonthlyPlan(value: Record<string, unknown>, productId: string, name: string, amount: string): boolean {
  const cycles = Array.isArray(value.billing_cycles) ? value.billing_cycles as Record<string, unknown>[] : [];
  const regular = cycles.find((cycle) => cycle.tenure_type === "REGULAR");
  const frequency = regular?.frequency as Record<string, unknown> | undefined;
  const pricing = regular?.pricing_scheme as Record<string, unknown> | undefined;
  const price = pricing?.fixed_price as Record<string, unknown> | undefined;
  return value.product_id === productId && value.name === name && value.status === "ACTIVE" && frequency?.interval_unit === "MONTH" && frequency?.interval_count === 1 && price?.value === amount && price?.currency_code === "USD";
}

async function main() {
  try {
    const product = await client.createCatalogProduct({ name: "ShowRing Support", type: "SERVICE", description: "Voluntary recurring support for ShowRing Game development and operation." }, `${requestPrefix}-product`);
    const productId = id(product, "product");
    const bronze = await plan("bronze", "Bronze Supporter", "2.00", productId);
    const silver = await plan("silver", "Silver Supporter", "5.00", productId);
    const gold = await plan("gold", "Gold Supporter", "10.00", productId);
    const ids = { bronze: id(bronze, "Bronze plan"), silver: id(silver, "Silver plan"), gold: id(gold, "Gold plan") };
    const verifiedProduct = await client.getCatalogProduct(productId);
    const verifiedPlans = await Promise.all([client.getBillingPlan(ids.bronze), client.getBillingPlan(ids.silver), client.getBillingPlan(ids.gold)]);
    if (verifiedProduct.name !== "ShowRing Support" || verifiedProduct.type !== "SERVICE" || !isVerifiedMonthlyPlan(verifiedPlans[0], productId, "Bronze Supporter", "2.00") || !isVerifiedMonthlyPlan(verifiedPlans[1], productId, "Silver Supporter", "5.00") || !isVerifiedMonthlyPlan(verifiedPlans[2], productId, "Gold Supporter", "10.00")) throw new Error(`PayPal ${environment} catalog verification failed.`);
    console.log(`${variablePrefix}_PRODUCT_ID=${productId}`);
    console.log(`${variablePrefix}_BRONZE_PLAN_ID=${ids.bronze}`);
    console.log(`${variablePrefix}_SILVER_PLAN_ID=${ids.silver}`);
    console.log(`${variablePrefix}_GOLD_PLAN_ID=${ids.gold}`);
  } catch (error) {
    console.error(error instanceof PayPalSupportError ? error.message : error instanceof Error ? error.message : `PayPal ${environment} provisioning failed.`);
    process.exitCode = 1;
  }
}

void main();
