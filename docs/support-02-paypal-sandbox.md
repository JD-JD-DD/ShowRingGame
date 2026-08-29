# PayPal Support configuration

ShowRing Support uses one explicit server-side provider environment:

```text
PAYPAL_ENVIRONMENT=sandbox
```

or:

```text
PAYPAL_ENVIRONMENT=live
```

The application never infers the environment from Vercel, `NODE_ENV`, a hostname, branch, or URL. Sandbox and Live credentials, product IDs, plan IDs, and webhook IDs are independent. Never copy Sandbox Product, Plan, or Webhook IDs into Live configuration.

## Sandbox — development and testing only

Sandbox uses `https://api-m.sandbox.paypal.com`. Configure only these server-side variables with `PAYPAL_ENVIRONMENT=sandbox`:

```text
PAYPAL_SANDBOX_CLIENT_ID=
PAYPAL_SANDBOX_CLIENT_SECRET=
PAYPAL_SANDBOX_PRODUCT_ID=
PAYPAL_SANDBOX_BRONZE_PLAN_ID=
PAYPAL_SANDBOX_SILVER_PLAN_ID=
PAYPAL_SANDBOX_GOLD_PLAN_ID=
PAYPAL_SANDBOX_WEBHOOK_ID=
```

The temporary `/test/support-sandbox` workflow remains Sandbox-only. Normal subscription and webhook processing use whichever explicit provider environment is selected.

## Live — production configuration

Live uses `https://api-m.paypal.com`. Configure only these server-side variables with `PAYPAL_ENVIRONMENT=live`:

```text
PAYPAL_LIVE_CLIENT_ID=
PAYPAL_LIVE_CLIENT_SECRET=
PAYPAL_LIVE_PRODUCT_ID=
PAYPAL_LIVE_BRONZE_PLAN_ID=
PAYPAL_LIVE_SILVER_PLAN_ID=
PAYPAL_LIVE_GOLD_PLAN_ID=
PAYPAL_LIVE_WEBHOOK_ID=
```

Each selected environment requires a complete matching family of values. Missing values fail before any PayPal request; ShowRing never falls back between environments.

## Catalog provisioning

Provisioning is a deliberate administrative operation and requires an explicit environment argument. It is not run during deployments or tests.

```text
node_modules\.bin\tsx.cmd scripts\provisionPayPalSupport.cts --environment=sandbox
node_modules\.bin\tsx.cmd scripts\provisionPayPalSupport.cts --environment=live
```

The command refuses to run without exactly one explicit `--environment=sandbox|live` value and refuses to create a second product when that environment's product ID is already configured. It creates one `ShowRing Support` `SERVICE` product and three active monthly USD plans:

| ShowRing tier | Plan | Monthly price | Configuration variable |
| --- | --- | ---: | --- |
| `BRONZE` | Bronze Supporter | $2.00 | `PAYPAL_<ENV>_BRONZE_PLAN_ID` |
| `SILVER` | Silver Supporter | $5.00 | `PAYPAL_<ENV>_SILVER_PLAN_ID` |
| `GOLD` | Gold Supporter | $10.00 | `PAYPAL_<ENV>_GOLD_PLAN_ID` |

The product description is: “Voluntary recurring support for ShowRing Game development and operation.” It conveys no gameplay access, competitive advantage, entitlement, or Premium status.

## Webhook

Create one webhook in the matching PayPal environment at:

```text
https://show-ring-game.vercel.app/api/webhooks/paypal
```

Select exactly these events:

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`

Store the returned webhook ID only in the matching `PAYPAL_<ENV>_WEBHOOK_ID` variable. The webhook route verifies signatures using the selected environment's credentials and webhook ID, then re-fetches the current subscription from that same environment.
