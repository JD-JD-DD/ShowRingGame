import { permanentRedirect } from "next/navigation";

export default async function BulletinCategoryCompatibilityPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  permanentRedirect(`/community/${categorySlug}`);
}
