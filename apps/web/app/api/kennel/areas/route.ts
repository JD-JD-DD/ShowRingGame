import { NextResponse } from "next/server";

function gone() {
  return NextResponse.json(
    {
      ok: false,
      error: "This legacy dog grouping endpoint is no longer available.",
    },
    { status: 410 }
  );
}

export function GET() {
  return gone();
}

export function POST() {
  return gone();
}
