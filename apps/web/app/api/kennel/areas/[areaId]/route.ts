import { NextResponse } from "next/server";

export function DELETE() {
  return NextResponse.json(
    {
      ok: false,
      error: "This legacy dog grouping endpoint is no longer available.",
    },
    { status: 410 }
  );
}
