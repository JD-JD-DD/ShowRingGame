export const PAYPAL_SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";

export const SUPPORT_TIERS = ["BRONZE", "SILVER", "GOLD"] as const;
export type SupportTierValue = (typeof SUPPORT_TIERS)[number];

export type PayPalSupportConfig = {
  clientId: string;
  clientSecret: string;
  productId: string;
  planIds: Record<SupportTierValue, string>;
};

export type PayPalWebhookVerificationHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

export type PayPalSupportSubscription = {
  id: string;
  status: string;
  planId: string;
  startTime: Date | null;
  nextBillingTime: Date | null;
};

export class PayPalSupportError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new PayPalSupportError("PayPal sandbox support is not configured.", 503);
  }
  return value;
}

export function getPayPalSupportConfig(): PayPalSupportConfig {
  const planIds = {
    BRONZE: requiredEnvironmentValue("PAYPAL_SANDBOX_PLAN_BRONZE_ID"),
    SILVER: requiredEnvironmentValue("PAYPAL_SANDBOX_PLAN_SILVER_ID"),
    GOLD: requiredEnvironmentValue("PAYPAL_SANDBOX_PLAN_GOLD_ID"),
  };

  if (new Set(Object.values(planIds)).size !== SUPPORT_TIERS.length) {
    throw new PayPalSupportError("PayPal sandbox support plan configuration is invalid.", 503);
  }

  return {
    clientId: requiredEnvironmentValue("PAYPAL_SANDBOX_CLIENT_ID"),
    clientSecret: requiredEnvironmentValue("PAYPAL_SANDBOX_CLIENT_SECRET"),
    productId: requiredEnvironmentValue("PAYPAL_SANDBOX_PRODUCT_ID"),
    planIds,
  };
}

export function getPayPalSandboxWebhookId(): string {
  return requiredEnvironmentValue("PAYPAL_SANDBOX_WEBHOOK_ID");
}

export function isSupportTier(value: unknown): value is SupportTierValue {
  return typeof value === "string" && (SUPPORT_TIERS as readonly string[]).includes(value);
}

export function getPayPalPlanId(
  tier: SupportTierValue,
  config: PayPalSupportConfig
): string {
  return config.planIds[tier];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePayPalSubscription(value: unknown): PayPalSupportSubscription {
  const subscription = asRecord(value);
  const billingInfo = asRecord(subscription?.billing_info);
  if (
    !subscription ||
    typeof subscription.id !== "string" ||
    typeof subscription.status !== "string" ||
    typeof subscription.plan_id !== "string"
  ) {
    throw new PayPalSupportError("PayPal returned an invalid subscription response.");
  }

  return {
    id: subscription.id,
    status: subscription.status,
    planId: subscription.plan_id,
    startTime: parseOptionalDate(subscription.start_time),
    nextBillingTime: parseOptionalDate(billingInfo?.next_billing_time),
  };
}

function findApprovalUrl(value: unknown): string | null {
  const subscription = asRecord(value);
  const links = Array.isArray(subscription?.links) ? subscription.links : [];
  for (const link of links) {
    const candidate = asRecord(link);
    if (candidate?.rel === "approve" && typeof candidate.href === "string") {
      return candidate.href;
    }
  }
  return null;
}

export type CreatedPayPalSupportSubscription = {
  providerSubscriptionId: string;
  approvalUrl: string | null;
};

export class PayPalSandboxClient {
  private accessToken: string | null = null;

  constructor(
    private readonly config: PayPalSupportConfig,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    let response: Response;
    try {
      response = await this.fetchImplementation(`${PAYPAL_SANDBOX_API_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
        cache: "no-store",
      });
    } catch {
      throw new PayPalSupportError("Unable to contact PayPal sandbox.");
    }

    if (!response.ok) {
      throw new PayPalSupportError("PayPal sandbox authentication failed.");
    }

    const payload = asRecord(await response.json().catch(() => null));
    if (!payload || typeof payload.access_token !== "string") {
      throw new PayPalSupportError("PayPal sandbox returned an invalid authentication response.");
    }

    this.accessToken = payload.access_token;
    return this.accessToken;
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const accessToken = await this.getAccessToken();
    let response: Response;
    try {
      response = await this.fetchImplementation(`${PAYPAL_SANDBOX_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store",
      });
    } catch {
      throw new PayPalSupportError("Unable to contact PayPal sandbox.");
    }

    if (!response.ok) {
      throw new PayPalSupportError("PayPal sandbox subscription request failed.");
    }

    return response.json().catch(() => {
      throw new PayPalSupportError("PayPal sandbox returned an invalid response.");
    });
  }

  async createSubscription(args: {
    tier: SupportTierValue;
  }): Promise<CreatedPayPalSupportSubscription> {
    const result = await this.request("POST", "/v1/billing/subscriptions", {
      plan_id: getPayPalPlanId(args.tier, this.config),
      application_context: { user_action: "SUBSCRIBE_NOW" },
    });
    const subscription = parsePayPalSubscription(result);

    return {
      providerSubscriptionId: subscription.id,
      approvalUrl: findApprovalUrl(result),
    };
  }

  async getSubscription(providerSubscriptionId: string): Promise<PayPalSupportSubscription> {
    if (!providerSubscriptionId.trim()) {
      throw new PayPalSupportError("PayPal subscription ID is required.", 400);
    }
    const result = await this.request(
      "GET",
      `/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}`
    );
    return parsePayPalSubscription(result);
  }

  async verifyWebhookSignature(args: {
    headers: PayPalWebhookVerificationHeaders;
    event: unknown;
    webhookId: string;
  }): Promise<boolean> {
    const result = asRecord(await this.request("POST", "/v1/notifications/verify-webhook-signature", {
      auth_algo: args.headers.authAlgo,
      cert_url: args.headers.certUrl,
      transmission_id: args.headers.transmissionId,
      transmission_sig: args.headers.transmissionSig,
      transmission_time: args.headers.transmissionTime,
      webhook_id: args.webhookId,
      webhook_event: args.event,
    }));
    return result?.verification_status === "SUCCESS";
  }
}

export function createPayPalSandboxClient(
  config = getPayPalSupportConfig()
): PayPalSandboxClient {
  return new PayPalSandboxClient(config);
}
