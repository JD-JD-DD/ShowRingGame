import { NextResponse } from "next/server";

export function buildDogPageUrl(request: Request, dogId: string) {
  return new URL(`/dogs/${dogId}`, request.url);
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
