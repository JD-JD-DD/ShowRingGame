import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export default async function KennelPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      homeDistrict: true,
      balance: true,
      reputationScore: true
    }
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>{kennel.name}</h1>
      <p>District: {kennel.homeDistrict}</p>
      <p>Balance: ${kennel.balance}</p>
    </main>
  );
}

