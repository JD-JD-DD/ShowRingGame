import { NextResponse } from "next/server";

export function normalizeAreaId(value: FormDataEntryValue | null): string | null {
  const areaId = String(value ?? "").trim();
  return areaId.length > 0 ? areaId : null;
}

export function buildDogPageUrl(
  request: Request,
  dogId: string,
  areaId?: string | null
) {
  const url = new URL(`/dogs/${dogId}`, request.url);

  if (areaId) {
    url.searchParams.set("areaId", areaId);
  }

  return url;
}

export function redirectToDogPageWithField(
  request: Request,
  dogId: string,
  field: string,
  message: string,
  areaId?: string | null
) {
  const url = buildDogPageUrl(request, dogId, areaId);
  url.searchParams.set(field, message);
  return NextResponse.redirect(url);
}
