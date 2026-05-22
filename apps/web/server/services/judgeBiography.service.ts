import fs from "node:fs";
import path from "node:path";

const JUDGE_BIOGRAPHIES_FILENAME = "Judge_Biographies.txt";

type JudgeBiography = {
  heading: string;
  paragraphs: string[];
};

function resolveJudgeBiographiesPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "docs", JUDGE_BIOGRAPHIES_FILENAME),
    path.resolve(process.cwd(), "..", "..", "docs", JUDGE_BIOGRAPHIES_FILENAME),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function normalizeBiographyKey(value: string): string {
  return value
    .replace(/\bJDG-\d{4}\b/gi, "")
    .replace(/[*_`[\]()]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseJudgeBiographies(source: string): Map<string, JudgeBiography> {
  const biographies = new Map<string, JudgeBiography>();
  let heading: string | null = null;
  let bodyLines: string[] = [];

  function saveCurrentBiography() {
    if (!heading) {
      return;
    }

    const body = bodyLines.join("\n").trim();

    biographies.set(normalizeBiographyKey(heading), {
      heading,
      paragraphs: body
        ? body
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
            .filter(Boolean)
        : [],
    });
  }

  for (const line of source.split(/\r?\n/)) {
    const headingMatch = line.trim().match(/^\*\*(.+?)\*\*$/);

    if (headingMatch) {
      saveCurrentBiography();
      heading = headingMatch[1].trim();
      bodyLines = [];
      continue;
    }

    bodyLines.push(line);
  }

  saveCurrentBiography();

  return biographies;
}

export function getJudgeBiography(args: {
  judgeCode: string;
  judgeName: string;
}): JudgeBiography | null {
  const sourcePath = resolveJudgeBiographiesPath();

  if (!sourcePath) {
    return null;
  }

  const biographies = parseJudgeBiographies(fs.readFileSync(sourcePath, "utf8"));

  return (
    biographies.get(normalizeBiographyKey(args.judgeCode)) ??
    biographies.get(normalizeBiographyKey(args.judgeName)) ??
    null
  );
}
