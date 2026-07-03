import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Legacy kennel areas have been retired. Use Kennel Runs.",
    },
    { status: 410 }
  );
}
