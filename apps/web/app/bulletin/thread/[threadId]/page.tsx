import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function BulletinTopicCompatibilityPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const topic = await db.bulletinThread.findUnique({
    where: { id: threadId },
    select: { category: { select: { slug: true } } },
  });
  if (!topic) notFound();
  permanentRedirect(`/community/${topic.category.slug}/${threadId}`);
}
