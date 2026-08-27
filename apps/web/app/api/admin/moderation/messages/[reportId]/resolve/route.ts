import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import {
  isCommunicationModerationAdmin,
  markCommunicationReportResolved,
} from "@/server/services/kennelCommunicationModeration.service";

export async function POST(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isCommunicationModerationAdmin(userId))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { reportId } = await params;
  if (!(await markCommunicationReportResolved(reportId))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.redirect(new URL(`/admin/moderation/messages/${reportId}`, _request.url), 303);
}
