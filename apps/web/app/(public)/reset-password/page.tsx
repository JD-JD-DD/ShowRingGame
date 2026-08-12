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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col">
        <header className="theme-panel mb-8 flex flex-col gap-6 rounded-[28px] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
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
            className="theme-secondary-button w-fit rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Back to Login
          </Link>
        </header>

        <section className="theme-panel rounded-[32px] p-7 sm:p-8">
          <div className="theme-neutral-badge mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
            Account Recovery
          </div>

          <h1 className="theme-heading text-3xl font-bold sm:text-4xl">
            Choose a new password.
          </h1>
          <p className="theme-copy mb-7 mt-3 text-sm leading-6 sm:text-base">
            Your new password must be at least 8 characters long.
          </p>

          <ResetPasswordForm token={token} />
        </section>
      </div>
    </main>
  );
}
