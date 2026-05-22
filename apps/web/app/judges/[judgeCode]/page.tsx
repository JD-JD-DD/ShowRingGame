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
    <main className="mx-auto max-w-3xl px-6 py-8 text-white">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] px-6 py-8 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
          Judge Profile
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
          {judge.name}
        </h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-purple-100/55">
          {judge.judgeCode}
        </p>

        <div className="mt-8 space-y-5 text-base leading-8 text-purple-50/85">
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
            className="inline-flex rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Back to Shows
          </Link>
        </div>
      </section>
    </main>
  );
}
