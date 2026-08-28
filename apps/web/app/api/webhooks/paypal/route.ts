import { NextResponse } from "next/server";
import { PayPalSupportError } from "@/server/services/paypalSupport.service";
import { parsePayPalWebhookEvent, PayPalWebhookError, processVerifiedPayPalWebhook, verifyPayPalWebhook } from "@/server/services/paypalWebhook.service";

export const runtime = "nodejs";

function verificationHeaders(request: Request) {
  const headers = {
    authAlgo: request.headers.get("PAYPAL-AUTH-ALGO"), certUrl: request.headers.get("PAYPAL-CERT-URL"),
    transmissionId: request.headers.get("PAYPAL-TRANSMISSION-ID"), transmissionSig: request.headers.get("PAYPAL-TRANSMISSION-SIG"),
    transmissionTime: request.headers.get("PAYPAL-TRANSMISSION-TIME"),
  };
  if (Object.values(headers).some((value) => !value)) throw new PayPalWebhookError("Missing PayPal verification headers.", 400);
  return headers as { authAlgo: string; certUrl: string; transmissionId: string; transmissionSig: string; transmissionTime: string };
}

export async function POST(request: Request) {
  try {
    const body: unknown = JSON.parse(await request.text());
    const event = parsePayPalWebhookEvent(body);
    await verifyPayPalWebhook({ headers: verificationHeaders(request), body });
    await processVerifiedPayPalWebhook({ event });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PayPalWebhookError || error instanceof PayPalSupportError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("POST /api/webhooks/paypal failed");
    return NextResponse.json({ ok: false, error: "Unable to process PayPal webhook." }, { status: 500 });
  }
}
