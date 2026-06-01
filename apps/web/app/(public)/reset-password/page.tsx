import Image from "next/image";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = firstQueryValue(query.token);

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto flex max-w-3xl flex-col">
        <header className="mb-8 flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="relative h-16 w-[250px] sm:h-20 sm:w-[320px]">
            <Image
              src="/logo.png"
              alt="ShowRing Game"
              fill
              className="object-contain object-left"
              priority
            />
          </Link>

          <Link
            href="/login"
            className="w-fit rounded-full border border-purple-300/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Back to Login
          </Link>
        </header>

        <section className="rounded-[32px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.94),rgba(24,12,35,0.96))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
          <div className="mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
            Account Recovery
          </div>

          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Choose a new password.
          </h1>
          <p className="mb-7 mt-3 text-sm leading-6 text-purple-100/78 sm:text-base">
            Your new password must be at least 8 characters long.
          </p>

          <ResetPasswordForm token={token} />
        </section>
      </div>
    </main>
  );
}
