import { NextResponse } from "next/server";

export function DELETE() {
  return NextResponse.json(
    {
      ok: false,
      error: "Legacy kennel areas have been retired. Use Kennel Runs.",
    },
    { status: 410 }
  );
}
