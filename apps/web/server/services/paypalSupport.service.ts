export const PAYPAL_SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";
export const PAYPAL_LIVE_API_BASE = "https://api-m.paypal.com";

export const PAYPAL_ENVIRONMENTS = ["sandbox", "live"] as const;
export type PayPalEnvironment = (typeof PAYPAL_ENVIRONMENTS)[number];

export const SUPPORT_TIERS = ["BRONZE", "SILVER", "GOLD"] as const;
export type SupportTierValue = (typeof SUPPORT_TIERS)[number];

export type PayPalSupportConfig = {
  environment: PayPalEnvironment;
  clientId: string;
  clientSecret: string;
  productId: string;
  planIds: Record<SupportTierValue, string>;
  webhookId: string;
};

type PayPalClientConfig = Pick<PayPalSupportConfig, "environment" | "clientId" | "clientSecret"> | PayPalSupportConfig;

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

export type PayPalProviderError = {
  name: string | null;
  message: string | null;
  debugId: string | null;
  details: Array<{ issue: string | null; description: string | null }>;
};

export class PayPalSupportError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerError: PayPalProviderError | null = null
  ) {
    super(message);
  }
}

type PayPalEnvironmentValues = Record<string, string | undefined>;

function requiredEnvironmentValue(name: string, values: PayPalEnvironmentValues = process.env): string {
  const value = values[name]?.trim();
  if (!value) {
    throw new PayPalSupportError("PayPal support is not configured.", 503);
  }
  return value;
}

export function getPayPalEnvironment(value = process.env.PAYPAL_ENVIRONMENT): PayPalEnvironment {
  if (value === "sandbox" || value === "live") return value;
  throw new PayPalSupportError("PayPal environment is not configured.", 503);
}

function environmentVariableName(environment: PayPalEnvironment, suffix: string): string {
  return `PAYPAL_${environment.toUpperCase()}_${suffix}`;
}

export function getPayPalSupportConfig(
  environment = getPayPalEnvironment(),
  values: PayPalEnvironmentValues = process.env
): PayPalSupportConfig {
  const planIds = {
    BRONZE: requiredEnvironmentValue(environmentVariableName(environment, "BRONZE_PLAN_ID"), values),
    SILVER: requiredEnvironmentValue(environmentVariableName(environment, "SILVER_PLAN_ID"), values),
    GOLD: requiredEnvironmentValue(environmentVariableName(environment, "GOLD_PLAN_ID"), values),
  };

  if (new Set(Object.values(planIds)).size !== SUPPORT_TIERS.length) {
    throw new PayPalSupportError("PayPal support plan configuration is invalid.", 503);
  }

  return {
    environment,
    clientId: requiredEnvironmentValue(environmentVariableName(environment, "CLIENT_ID"), values),
    clientSecret: requiredEnvironmentValue(environmentVariableName(environment, "CLIENT_SECRET"), values),
    productId: requiredEnvironmentValue(environmentVariableName(environment, "PRODUCT_ID"), values),
    planIds,
    webhookId: requiredEnvironmentValue(environmentVariableName(environment, "WEBHOOK_ID"), values),
  };
}

export function getPayPalWebhookId(config = getPayPalSupportConfig()): string {
  return config.webhookId;
}

export function getPayPalApiBase(environment: PayPalEnvironment): string {
  return environment === "sandbox" ? PAYPAL_SANDBOX_API_BASE : PAYPAL_LIVE_API_BASE;
}

export function getPayPalProvisioningConfig(
  environment: PayPalEnvironment,
  values: PayPalEnvironmentValues = process.env
): Pick<PayPalSupportConfig, "environment" | "clientId" | "clientSecret"> {
  return {
    environment,
    clientId: requiredEnvironmentValue(environmentVariableName(environment, "CLIENT_ID"), values),
    clientSecret: requiredEnvironmentValue(environmentVariableName(environment, "CLIENT_SECRET"), values),
  };
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

function parsePayPalProviderError(value: unknown): PayPalProviderError {
  const error = asRecord(value);
  const details = Array.isArray(error?.details) ? error.details : [];
  return {
    name: typeof error?.name === "string" ? error.name : null,
    message: typeof error?.message === "string" ? error.message : null,
    debugId: typeof error?.debug_id === "string" ? error.debug_id : null,
    details: details.map((detail) => {
      const parsed = asRecord(detail);
      return {
        issue: typeof parsed?.issue === "string" ? parsed.issue : null,
        description: typeof parsed?.description === "string" ? parsed.description : null,
      };
    }),
  };
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

function parseCreatedPayPalSubscription(value: unknown): { id: string; status: string } {
  const subscription = asRecord(value);
  if (!subscription || typeof subscription.id !== "string" || typeof subscription.status !== "string") {
    throw new PayPalSupportError("PayPal returned an invalid subscription response.");
  }
  return { id: subscription.id, status: subscription.status };
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

export class PayPalClient {
  private accessToken: string | null = null;

  constructor(
    private readonly config: PayPalClientConfig,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    let response: Response;
    try {
      response = await this.fetchImplementation(`${getPayPalApiBase(this.config.environment)}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
        cache: "no-store",
      });
    } catch {
      throw new PayPalSupportError("Unable to contact PayPal.");
    }

    if (!response.ok) {
      throw new PayPalSupportError("PayPal authentication failed.");
    }

    const payload = asRecord(await response.json().catch(() => null));
    if (!payload || typeof payload.access_token !== "string") {
      throw new PayPalSupportError("PayPal returned an invalid authentication response.");
    }

    this.accessToken = payload.access_token;
    return this.accessToken;
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown, requestId?: string): Promise<unknown> {
    const accessToken = await this.getAccessToken();
    let response: Response;
    try {
      response = await this.fetchImplementation(`${getPayPalApiBase(this.config.environment)}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store",
      });
    } catch {
      throw new PayPalSupportError("Unable to contact PayPal.");
    }

    if (!response.ok) {
      throw new PayPalSupportError(
        "PayPal subscription request failed.",
        response.status,
        parsePayPalProviderError(await response.json().catch(() => null))
      );
    }

    if (response.status === 204) return null;
    return response.json().catch(() => {
      throw new PayPalSupportError("PayPal returned an invalid response.");
    });
  }

  async createSubscription(args: {
    tier: SupportTierValue;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<CreatedPayPalSupportSubscription> {
    if (!("planIds" in this.config)) {
      throw new PayPalSupportError("PayPal support is not configured.", 503);
    }
    const result = await this.request("POST", "/v1/billing/subscriptions", {
      plan_id: getPayPalPlanId(args.tier, this.config),
      application_context: {
        user_action: "SUBSCRIBE_NOW",
        return_url: args.returnUrl,
        cancel_url: args.cancelUrl,
      },
    });
    const subscription = parseCreatedPayPalSubscription(result);

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

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    await this.request("POST", `/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, { reason: "ShowRing sandbox test reset" });
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

  async createCatalogProduct(body: unknown, requestId: string): Promise<Record<string, unknown>> {
    return asRecord(await this.request("POST", "/v1/catalogs/products", body, requestId)) ?? {};
  }

  async createBillingPlan(body: unknown, requestId: string): Promise<Record<string, unknown>> {
    return asRecord(await this.request("POST", "/v1/billing/plans", body, requestId)) ?? {};
  }

  async getCatalogProduct(productId: string): Promise<Record<string, unknown>> {
    return asRecord(await this.request("GET", `/v1/catalogs/products/${encodeURIComponent(productId)}`)) ?? {};
  }

  async getBillingPlan(planId: string): Promise<Record<string, unknown>> {
    return asRecord(await this.request("GET", `/v1/billing/plans/${encodeURIComponent(planId)}`)) ?? {};
  }
}

export function createPayPalClient(
  config: PayPalClientConfig = getPayPalSupportConfig()
): PayPalClient {
  return new PayPalClient(config);
}

export function createPayPalSandboxClient(): PayPalClient {
  return createPayPalClient(getPayPalSupportConfig("sandbox"));
}
