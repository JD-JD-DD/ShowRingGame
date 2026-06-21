import { NextResponse } from "next/server";
import { verifyEmailWithToken } from "@/lib/emailVerification";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  try {
    const verified = await verifyEmailWithToken(token);
    const destination = new URL("/verify-email", request.url);
    destination.searchParams.set("status", verified ? "verified" : "invalid");
    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("Unable to verify email.", error);
    const destination = new URL("/verify-email?status=invalid", request.url);
    return NextResponse.redirect(destination);
  }
}
