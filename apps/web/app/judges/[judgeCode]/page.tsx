import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getJudgeBiography } from "@/server/services/judgeBiography.service";

export default async function JudgeProfilePage({
  params,
}: {
  params: Promise<{ judgeCode: string }>;
}) {
  const { judgeCode } = await params;
  const requestedJudgeCode = decodeURIComponent(judgeCode);
  const judge = await db.judge.findFirst({
    where: {
      OR: [
        { judgeCode: requestedJudgeCode },
        { judgeCode: requestedJudgeCode.toUpperCase() },
      ],
    },
    select: {
      judgeCode: true,
      name: true,
    },
  });

  if (!judge) {
    notFound();
  }

  const biography = getJudgeBiography({
    judgeCode: judge.judgeCode,
    judgeName: judge.name,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <section className="theme-panel rounded-[28px] px-6 py-8">
        <p className="theme-label text-sm uppercase tracking-[0.22em]">
          Judge Profile
        </p>
        <h1 className="theme-heading mt-3 text-4xl font-bold tracking-tight">
          {judge.name}
        </h1>
        <p className="theme-copy mt-3 text-sm font-semibold uppercase tracking-[0.18em]">
          {judge.judgeCode}
        </p>

        <div className="theme-copy mt-8 space-y-5 text-base leading-8">
          {biography && biography.paragraphs.length > 0 ? (
            biography.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))
          ) : (
            <p>A biography has not been added for this judge yet.</p>
          )}
        </div>

        <div className="mt-8">
          <Link
            href="/shows"
            className="theme-secondary-button inline-flex rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Back to Shows
          </Link>
        </div>
      </section>
    </main>
  );
}
