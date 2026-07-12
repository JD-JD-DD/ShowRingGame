export default function BreedDogLoading() {
  return (
    <main className="breeding-page mx-auto max-w-7xl px-6 py-8">
      <div
        role="status"
        aria-live="polite"
        className="theme-panel rounded-[28px] px-6 py-8"
      >
        <p className="theme-label text-sm uppercase tracking-[0.25em]">
          Breeding
        </p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">
          Loading breeding options...
        </h1>
        <p className="theme-copy mt-3 text-sm leading-7">
          Gathering compatible mates and available stud options for this dog.
        </p>
      </div>
    </main>
  );
}
