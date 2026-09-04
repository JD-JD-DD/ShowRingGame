"use client";

import { useId, useState } from "react";
import { BRUCELLOSIS_TEST_FEE } from "@showring/rules";
import type { DogProfileDto } from "@/server/mappers/dog.mapper";
import HealthTestingPanel from "./HealthTestingPanel";

type Props = { profile: DogProfileDto; kennelRunId: string | null; canManage: boolean; healthMessage: string | null; healthError: string | null };

function withKennelRunContext(action: string, kennelRunId: string | null) {
  if (!kennelRunId) return action;
  const url = new URL(action, "http://dog-page.local");
  url.searchParams.set("kennelRunId", kennelRunId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function statusMessage(message: string | null, isError = false) {
  if (!message) return null;
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${isError ? "theme-notice theme-notice--danger" : "theme-notice theme-notice--success"}`}>{message}</div>;
}

function formatBreedingSafetyCost(amount: number): string { return `$${amount.toLocaleString()}`; }

export default function DogProfileHealthActions({ profile, kennelRunId, canManage, healthMessage, healthError }: Props) {
  const [openPanel, setOpenPanel] = useState<"tests" | "brucellosis" | null>(null);
  const testsId = useId();
  const screeningId = useId();
  const { header, healthTesting } = profile;
  const healthControls = healthTesting.ownerControls;
  const screening = healthTesting.breedingSafetyScreening[0] ?? null;
  if (!canManage) return null;

  return <div className="mt-6 space-y-3">
    {statusMessage(healthMessage)}
    {statusMessage(healthError, true)}
    <div className="flex flex-wrap gap-2">
      {healthControls?.checkoutNeeded ? <button type="button" aria-expanded={openPanel === "tests"} aria-controls={testsId} onClick={() => setOpenPanel(openPanel === "tests" ? null : "tests")} className="theme-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold">Order Health Tests</button> : null}
      {screening ? <button type="button" aria-expanded={openPanel === "brucellosis"} aria-controls={screeningId} onClick={() => setOpenPanel(openPanel === "brucellosis" ? null : "brucellosis")} className="theme-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold">{screening.isCurrentNegative ? "Repeat Brucellosis Screening" : "Run Brucellosis Screening"}</button> : null}
    </div>
    {openPanel === "tests" ? <div id={testsId}><HealthTestingPanel action={`/api/dogs/${header.dogId}/health-tests${kennelRunId ? `?kennelRunId=${encodeURIComponent(kennelRunId)}` : ""}`} kennelBalance={healthControls?.kennelBalance ?? 0} canOrderHealthTests={Boolean(healthControls?.checkoutNeeded)} rows={healthTesting.tests.map((test) => ({ testTypeCode: test.testCode, label: test.displayName, fee: test.cost, isAvailable: test.isCurrentlyAvailable, availabilityLabel: test.minimumAgeLabel, result: test.isComplete ? { label: test.resultLabel ?? "Complete", testedLabel: test.testedDateLabel ?? "Test date unavailable", severity: test.severityKey ?? "yellow", impactStatement: test.healthImpactStatement } : null }))} /></div> : null}
    {openPanel === "brucellosis" && screening ? <div id={screeningId} className="dog-card rounded-2xl p-4"><p className="dog-copy text-sm">{screening.helperText}</p><form action={withKennelRunContext(`/api/dogs/${header.dogId}/brucellosis-screening`, kennelRunId)} method="post" className="mt-3"><button type="submit" className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold">{screening.isCurrentNegative ? "Repeat Screening" : "Run Brucellosis Screening"} <span className="ml-2 text-[var(--color-primary-foreground)]">{formatBreedingSafetyCost(BRUCELLOSIS_TEST_FEE)}</span></button></form></div> : null}
  </div>;
}
