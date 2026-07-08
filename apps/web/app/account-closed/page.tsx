export default function AccountClosedPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-6 py-16">
      <section aria-labelledby="account-closed-heading">
        <h1
          id="account-closed-heading"
          className="text-3xl font-bold text-[var(--foreground)]"
        >
          Account closed
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--foreground)]">
          This account or kennel has been closed for a policy violation. If you
          believe this is an error, contact the game administrator.
        </p>
      </section>
    </main>
  );
}
