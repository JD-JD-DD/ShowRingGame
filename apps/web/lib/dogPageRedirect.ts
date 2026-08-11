import { NextResponse } from "next/server";

export function buildDogPageUrl(request: Request, dogId: string) {
  const url = new URL(`/dogs/${dogId}`, request.url);
  const kennelRunId = new URL(request.url).searchParams.get("kennelRunId");

  if (kennelRunId) {
    url.searchParams.set("kennelRunId", kennelRunId);
  }

  return url;
}

export function redirectToDogPageWithField(
  request: Request,
  dogId: string,
  field: string,
  message: string
) {
  const url = buildDogPageUrl(request, dogId);
  url.searchParams.set(field, message);
  return NextResponse.redirect(url);
}
