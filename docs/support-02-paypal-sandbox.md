# SUPPORT-02 PayPal sandbox configuration

SUPPORT-02 uses only `https://api-m.sandbox.paypal.com`. Product and billing-plan provisioning is a one-time PayPal sandbox administration task; normal player requests never create products or plans.

Create exactly one PayPal sandbox Catalog Product for voluntary ShowRing Support. Under that product, create exactly these fixed monthly USD plans:

| ShowRing tier | Monthly price | Configuration variable |
| --- | ---: | --- |
| `BRONZE` | $2.00 | `PAYPAL_SANDBOX_PLAN_BRONZE_ID` |
| `SILVER` | $5.00 | `PAYPAL_SANDBOX_PLAN_SILVER_ID` |
| `GOLD` | $10.00 | `PAYPAL_SANDBOX_PLAN_GOLD_ID` |

Set these server-only environment variables through the normal deployment/environment configuration mechanism:

```text
PAYPAL_SANDBOX_CLIENT_ID=
PAYPAL_SANDBOX_CLIENT_SECRET=
PAYPAL_SANDBOX_PRODUCT_ID=
PAYPAL_SANDBOX_PLAN_BRONZE_ID=
PAYPAL_SANDBOX_PLAN_SILVER_ID=
PAYPAL_SANDBOX_PLAN_GOLD_ID=
PAYPAL_SANDBOX_WEBHOOK_ID=
```

Do not use `NEXT_PUBLIC_` names. `PAYPAL_SANDBOX_WEBHOOK_ID` is the sandbox webhook ID PayPal assigns to the endpoint; it is used only by server-side signature verification. The application maps only the canonical `SupportTier` values to these configured plan IDs and does not accept plan IDs, prices, currencies, provider subscription IDs, or account IDs from the browser.

The subscription API is intentionally server-only foundation work. It can return PayPal's approval URL after creating and verifying a sandbox subscription, but SUPPORT-02 adds no Support page, button, redirect UI, webhook synchronization, lifecycle management, badge behavior, or Premium entitlement behavior.
