import Link from "next/link";

import { formatShowAwardLabels } from "@/lib/showAwards";
import type { DogProfileShowResultDto } from "@/server/mappers/dog.mapper";

type DogShowRecordTableProps = {
  results: DogProfileShowResultDto[];
  emptyMessage?: string;
};

export default function DogShowRecordTable({
  results,
  emptyMessage = "No published show results yet.",
}: DogShowRecordTableProps) {
  if (results.length === 0) {
    return (
      <div className="dog-card dog-copy rounded-2xl p-4 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="dog-label text-left text-xs uppercase tracking-[0.16em]">
            <th className="px-3 py-2">Show</th>
            <th className="px-3 py-2">Breed</th>
            <th className="px-3 py-2">Judge</th>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.resultId} className="dog-card">
              <td className="rounded-l-2xl px-3 py-3">
                <Link href={result.showUrl} className="dog-heading font-semibold hover:underline">
                  {result.showName}
                </Link>
                <div className="dog-copy text-xs">
                  {result.showDateLabel}
                  {result.showDayNumber !== null ? ` · Day ${result.showDayNumber}` : ""} ·{" "}
                  {result.districtRegion}
                </div>
              </td>
              <td className="px-3 py-3">
                <Link href={result.breedResultUrl} className="dog-accent-link font-semibold hover:underline">
                  {result.breedCode2}
                </Link>
              </td>
              <td className="px-3 py-3">
                <Link href={result.judgeProfileUrl} className="dog-heading font-semibold hover:underline">
                  {result.judgeName}
                </Link>
              </td>
              <td className="px-3 py-3">{formatShowAwardLabels(result.awardCodes) || "None"}</td>
              <td className="dog-heading rounded-r-2xl px-3 py-3 text-right font-semibold">
                {result.pointsAwarded}
                {result.isMajor ? <div className="text-xs text-amber-600 dark:text-amber-200">Major</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
