import { fail, ok } from '@/lib/http';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('Unauthorized.', 401);

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      kennels: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!user) return fail('Unauthorized.', 401);

  return ok({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    hasKennel: user.kennels.length > 0,
    kennel: user.kennels[0] ?? null,
  });
}
