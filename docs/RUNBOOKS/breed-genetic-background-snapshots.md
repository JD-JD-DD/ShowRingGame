# Breed Genetic Background Snapshots

## Purpose

The authorized `GET /api/cron/maintain-breed-genetic-background` job periodically discovers completed Invitational clusters and creates the corresponding annual breed genetic-background snapshots. The cluster's game year and `endEpoch` are the durable snapshot identity/time, not wall-clock time.

## Verification

Inspect the cron response/log summary for failed years. A successful retry is safe: existing `(breedCode2, gameYear, backgroundRulesVersion)` records are retained rather than rewritten.

## Failure handling

Failure does not alter completed Invitational history. Restore the job and let the periodic trigger retry. For a controlled repair or diagnostic rerun, preserve the existing manual path:

`pnpm --filter web snapshot:breed-genetic-background -- <gameYear> <snapshotEpoch>`

The manual command verifies source consistency for an already-existing annual snapshot; it intentionally reports a conflict rather than rewriting historical snapshot truth.
