import { fail, ok } from '@/lib/http';
import { getSession } from '@/lib/session';
import { getKennelForUser } from '@/server/services/kennel.service';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('Unauthorized.', 401);

  const kennel = await getKennelForUser(session.userId);
  if (!kennel) return fail('Kennel not found.', 404, { hasKennel: false });

  return ok({
    kennel: {
      id: kennel.id,
      name: kennel.name,
      slug: kennel.slug,
      balance: kennel.balance,
      homeDistrictId: kennel.homeDistrictId,
      createdAt: kennel.createdAt,
      dogCount: kennel._count.ownedDogs,
    },
  });
}
