import {
  getCurrentPublishedBreedKennelPrestigeLeaderboardState,
  getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration,
  publishCompleteBreedKennelPrestigeLeaderboardGeneration,
} from "@/server/services/breedKennelPrestigeLeaderboard.service";
import { processBreedKennelPrestigeLeaderboardBatch } from "@/server/services/breedKennelPrestigeLeaderboardWorker.service";

export type BreedKennelPrestigeLeaderboardOperation = "process" | "publish";

type OrchestrationDependencies = {
  processBatch?: typeof processBreedKennelPrestigeLeaderboardBatch;
  getWorkingGeneration?: typeof getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration;
  getPublishedState?: typeof getCurrentPublishedBreedKennelPrestigeLeaderboardState;
  publishGeneration?: typeof publishCompleteBreedKennelPrestigeLeaderboardGeneration;
};

function remainingBreeds(generation: Awaited<ReturnType<typeof getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration>>) {
  return generation?.manifestBreeds.filter((breed) => !breed.completedAt).length ?? 0;
}

export function createBreedKennelPrestigeLeaderboardOrchestrator(
  dependencies: OrchestrationDependencies = {}
) {
  const processBatch = dependencies.processBatch ?? processBreedKennelPrestigeLeaderboardBatch;
  const getWorkingGeneration = dependencies.getWorkingGeneration ?? getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration;
  const getPublishedState = dependencies.getPublishedState ?? getCurrentPublishedBreedKennelPrestigeLeaderboardState;
  const publishGeneration = dependencies.publishGeneration ?? publishCompleteBreedKennelPrestigeLeaderboardGeneration;

  return async function orchestrateBreedKennelPrestigeLeaderboard(
    operation: BreedKennelPrestigeLeaderboardOperation
  ) {
    const startedAtMs = Date.now();
    try {
      if (operation === "process") {
        // Deliberately omit arguments: the worker's bounded default is exactly one breed.
        const batchStartedAtMs = Date.now();
        const worker = await processBatch();
        const generation = await getWorkingGeneration();
        const remaining = remainingBreeds(generation);
        const outcome = generation
          ? remaining === 0
            ? "generation_calculation_complete"
            : worker.outcome
          : worker.outcome === "no_working_generation"
            ? "no_working_generation"
            : "superseded";
        const result = {
          operation,
          outcome,
          generationId: generation?.id ?? worker.generationId ?? null,
          workerOutcome: worker.outcome,
          completed: worker.completed,
          remaining,
          batchDurationMs: Date.now() - batchStartedAtMs,
          publicationOutcome: "not_attempted",
          durationMs: Date.now() - startedAtMs,
        };
        console.info("breed-kennel-prestige-leaderboard-orchestration", result);
        return result;
      }

      const generation = await getWorkingGeneration();
      if (!generation) {
        const state = await getPublishedState();
        const result = {
          operation,
          outcome: state?.publishedGenerationId ? "already_published" : "no_working_generation",
          generationId: state?.publishedGenerationId ?? null,
          completed: 0,
          remaining: 0,
          publicationOutcome: state?.publishedGenerationId ? "already_published" : "not_attempted",
          durationMs: Date.now() - startedAtMs,
        };
        console.info("breed-kennel-prestige-leaderboard-orchestration", result);
        return result;
      }

      const remaining = remainingBreeds(generation);
      if (remaining) {
        const result = { operation, outcome: "generation_incomplete", generationId: generation.id, completed: generation.manifestBreeds.length - remaining, remaining, publicationOutcome: "not_attempted", durationMs: Date.now() - startedAtMs };
        console.info("breed-kennel-prestige-leaderboard-orchestration", result);
        return result;
      }

      try {
        // The persistence transaction repeats both active-generation and completeness validation.
        await publishGeneration({ generationId: generation.id });
        const result = { operation, outcome: "published", generationId: generation.id, completed: generation.manifestBreeds.length, remaining: 0, publicationOutcome: "published", durationMs: Date.now() - startedAtMs };
        console.info("breed-kennel-prestige-leaderboard-orchestration", result);
        return result;
      } catch (error) {
        const outcome = error instanceof Error && /active breed leaderboard generation|publication claim was lost/i.test(error.message)
          ? "superseded"
          : error instanceof Error && /incomplete breed leaderboard generation/i.test(error.message)
            ? "generation_incomplete"
            : "publication_failed";
        const result = { operation, outcome, generationId: generation.id, completed: generation.manifestBreeds.length, remaining: 0, publicationOutcome: outcome, durationMs: Date.now() - startedAtMs };
        console.error("breed-kennel-prestige-leaderboard-orchestration failed", { ...result, errorType: error instanceof Error ? error.name : "unknown" });
        return result;
      }
    } catch (error) {
      const outcome = operation === "publish" ? "publication_failed" : "calculation_failed";
      const result = { operation, outcome, generationId: null, completed: 0, remaining: 0, publicationOutcome: operation === "publish" ? outcome : "not_attempted", durationMs: Date.now() - startedAtMs };
      console.error("breed-kennel-prestige-leaderboard-orchestration failed", { ...result, errorType: error instanceof Error ? error.name : "unknown" });
      return result;
    }
  };
}

export const orchestrateBreedKennelPrestigeLeaderboard =
  createBreedKennelPrestigeLeaderboardOrchestrator();
