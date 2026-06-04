import { repairFutureShowEntryWindows } from "../server/services/showSchedule.service";

async function main() {
  const result = await repairFutureShowEntryWindows();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
