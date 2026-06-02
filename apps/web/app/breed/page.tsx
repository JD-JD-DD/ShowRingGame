import BreedingPlannerPage from "@/components/breeding/BreedingPlannerPage";

type PageProps = {
  searchParams?: Promise<{
    dogId?: string | string[];
    studListingId?: string | string[];
  }>;
};

export default function BreedDogPage({ searchParams }: PageProps) {
  return (
    <BreedingPlannerPage
      experience="breed-dog"
      searchParams={searchParams}
    />
  );
}
