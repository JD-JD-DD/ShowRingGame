"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";

import type { MyResultsClusterCursor, MyResultsPage } from "./myResults.loader";
import { loadMyResultsPage } from "./myResults.loader";

export async function loadMoreMyResults(
  cursor: MyResultsClusterCursor
): Promise<MyResultsPage> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!kennel) redirect("/onboarding");

  return loadMyResultsPage({
    kennelId: kennel.id,
    currentEpoch: getCurrentEpoch(),
    cursor,
  });
}
