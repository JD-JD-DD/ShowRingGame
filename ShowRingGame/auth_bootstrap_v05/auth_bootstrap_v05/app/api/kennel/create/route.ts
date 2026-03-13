import { fail, ok } from '@/lib/http';
import { getSession } from '@/lib/session';
import { createKennelForUser } from '@/server/services/kennel.service';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail('Unauthorized.', 401);

  try {
    const body = await request.json();
    const kennel = await createKennelForUser(session.userId, body);

    return ok({ kennel });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create kennel.';
    return fail(message, 400);
  }
}
