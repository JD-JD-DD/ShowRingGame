import { isAuthorizedJobRequest } from "../lib/jobAuthorization";

function assertEqual(actual: boolean, expected: boolean, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

assertEqual(isAuthorizedJobRequest({ authorization: "Bearer cron", cronSecret: "cron", manualSecret: "manual" }), true, "Vercel cron secret accepted");
assertEqual(isAuthorizedJobRequest({ authorization: "Bearer manual", cronSecret: "cron", manualSecret: "manual" }), true, "manual fallback secret accepted");
assertEqual(isAuthorizedJobRequest({ authorization: "Bearer wrong", cronSecret: "cron", manualSecret: "manual" }), false, "wrong secret rejected");
assertEqual(isAuthorizedJobRequest({ authorization: null, cronSecret: "cron" }), false, "missing authorization rejected");
console.log("Maintain show schedule authorization checks passed.");
