import { createSession, setSessionCookie } from '@/lib/session';
import { fail, ok } from '@/lib/http';
import { signupUser } from '@/server/services/auth.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await signupUser(body);

    const token = await createSession({
      userId: result.user.id,
      email: result.user.email,
    });

    await setSessionCookie(token);

    return ok({
      user: result.user,
      hasKennel: result.hasKennel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to sign up.';
    return fail(message, 400);
  }
}
