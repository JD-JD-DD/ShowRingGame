type PageProps = {
  params: {
    dogId: string;
  };
};

export default function DogPage({ params }: PageProps) {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold">Dog Profile</h1>

        <p className="mt-4 text-neutral-400">
          Dog ID: {params.dogId}
        </p>

        <p className="mt-2 text-neutral-500">
          Dog profile page coming soon.
        </p>
      </div>
    </main>
  );
}
