import BreedingPlannerPage from "@/components/breeding/BreedingPlannerPage";

type PageProps = {
  searchParams?: Promise<{
    breedCode2?: string | string[];
  }>;
};

export default function PlanALitterPage({ searchParams }: PageProps) {
  return (
    <BreedingPlannerPage
      experience="worksheet"
      returnMode="stayOnPlanner"
      searchParams={searchParams}
    />
  );
}
