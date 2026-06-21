import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import VerificationActions from "./VerificationActions";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const userId = await getSessionUserId();
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerifiedAt: true }
      })
    : null;
  const isVerified = Boolean(user?.emailVerifiedAt) || status === "verified";

  return (
    <main className="min-h-screen px-6 py-12 text-white">
      <section className="mx-auto max-w-xl rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.94),rgba(24,12,35,0.96))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
          Account security
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          {isVerified ? "Email verified" : "Verify your email"}
        </h1>

        {isVerified ? (
          <>
            <p className="mt-4 leading-7 text-purple-100/78">
              Your email is verified and attached to your ShowRing account.
            </p>
            <Link
              href="/kennel"
              className="mt-6 inline-flex rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
            >
              Continue to your kennel
            </Link>
          </>
        ) : user ? (
          <>
            <p className="mt-4 leading-7 text-purple-100/78">
              We will send a one-time verification link to {user.email}. The link
              expires after 24 hours.
            </p>
            {status === "invalid" ? (
              <p className="mt-4 rounded-2xl border border-red-300/30 bg-red-950/35 px-4 py-3 text-sm text-red-100">
                That verification link is invalid or has expired. Request a new one below.
              </p>
            ) : null}
            <VerificationActions />
          </>
        ) : (
          <>
            <p className="mt-4 leading-7 text-purple-100/78">
              {status === "invalid"
                ? "That verification link is invalid or has expired. Log in to request a new one."
                : "Log in to request a verification link or continue to your account."}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
            >
              Log in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
