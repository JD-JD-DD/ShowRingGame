type PerfBaseDetails = {
  route: string;
  userContextPresent?: boolean;
  kennelContextPresent?: boolean;
};

export function estimateJsonSizeBytes(value: unknown): number | null {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return null;
  }
}

export function createPerfTimer(base: PerfBaseDetails) {
  const startedAtMs = Date.now();
  const phases: Record<string, number> = {};

  async function measure<T>(phase: string, action: () => Promise<T>): Promise<T> {
    const phaseStartedAtMs = Date.now();

    try {
      return await action();
    } finally {
      phases[phase] = (phases[phase] ?? 0) + (Date.now() - phaseStartedAtMs);
    }
  }

  function log(details: Record<string, unknown> = {}) {
    console.info("route-perf", {
      ...base,
      totalServerDurationMs: Date.now() - startedAtMs,
      ...phases,
      ...details,
    });
  }

  return {
    measure,
    log,
  };
}
