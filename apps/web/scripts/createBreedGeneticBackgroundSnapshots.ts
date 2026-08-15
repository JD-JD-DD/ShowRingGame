import { createBreedGeneticBackgroundSnapshots } from "@/server/services/breedGeneticBackground.service";
const [gameYear, snapshotEpoch] = process.argv.slice(2).map(Number);
if (!Number.isInteger(gameYear) || !Number.isInteger(snapshotEpoch)) throw new Error("Usage: createBreedGeneticBackgroundSnapshots <gameYear> <snapshotEpoch>");
createBreedGeneticBackgroundSnapshots({ gameYear, snapshotEpoch }).then((reports)=>console.info("GEN-05 snapshots complete", reports)).finally(()=>process.exit());
