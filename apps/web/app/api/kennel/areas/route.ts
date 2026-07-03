import { NextResponse } from "next/server";

function gone() {
  return NextResponse.json(
    {
      ok: false,
      error: "Legacy kennel areas have been retired. Use Kennel Runs.",
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
