"use client";

import { useMemo, useState } from "react";
import {
  hasPuppyBack,
  normalizeStudOfferTermsAfterChange,
  type EditableStudOfferTerms,
  type StudCompensationType,
  type StudPuppyPickPosition,
} from "@showring/rules";

type StudOfferWorksheetProps = {
  dogName: string;
};

type WorksheetStepId =
  | "compensation"
  | "puppy-back"
  | "return-service"
  | "dam-requirements"
  | "approval"
  | "review";

type WorksheetStep = {
  id: WorksheetStepId;
  name: string;
  description: string;
};

export const STUD_OFFER_WORKSHEET_COPY = {
  title: "Stud Owner Worksheet",
  subtitle:
    "Set up the terms for this dog’s future stud offer. Publishing will be available in a later stage.",
  back: "Back",
  next: "Next",
  futureStep: "This section will be added in a later worksheet stage.",
  publishingLater: "Publishing will be added in a later stage.",
} as const;

export const STUD_OFFER_WORKSHEET_STEPS: readonly WorksheetStep[] = [
  {
    id: "compensation",
    name: "Compensation",
    description: "Choose how the future stud offer will be compensated.",
  },
  {
    id: "puppy-back",
    name: "Puppy-Back Terms",
    description: "Define pick position, sex, and minimum litter terms.",
  },
  {
    id: "return-service",
    name: "Return Service",
    description: "Set the future return-service terms.",
  },
  {
    id: "dam-requirements",
    name: "Dam Requirements",
    description: "Set the future dam health, title, and brucellosis requirements.",
  },
  {
    id: "approval",
    name: "Approval",
    description: "Choose how future stud requests will be approved.",
  },
  {
    id: "review",
    name: "Review & Publish",
    description: "Review your terms before publishing becomes available.",
  },
];

export const INITIAL_STUD_OFFER_TERMS: EditableStudOfferTerms = {
  compensationType: null,
  cashAmount: null,
  puppyPickPosition: null,
  puppySex: null,
  minimumLitterSize: null,
  noLitterReturnService: false,
  smallLitterReturnThreshold: null,
  brucellosisNegativeRequired: false,
  titleRequirement: null,
  approvalMode: null,
  healthRequirements: [],
};

function getActiveSteps(terms: EditableStudOfferTerms): WorksheetStep[] {
  return STUD_OFFER_WORKSHEET_STEPS.filter(
    (step) => step.id !== "puppy-back" || hasPuppyBack(terms.compensationType)
  );
}

function adjustIndexAfterPuppyBackRemoval(index: number): number {
  if (index <= 1) return 0;
  return index - 1;
}

export default function StudOfferWorksheet({ dogName }: StudOfferWorksheetProps) {
  const [terms, setTerms] = useState<EditableStudOfferTerms>(
    INITIAL_STUD_OFFER_TERMS
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [furthestReachedStepIndex, setFurthestReachedStepIndex] = useState(0);
  const activeSteps = useMemo(() => getActiveSteps(terms), [terms]);
  const currentStep = activeSteps[currentStepIndex] ?? activeSteps[0];

  function updateTerm(
    field: "compensationType",
    value: StudCompensationType | null
  ): void;
  function updateTerm(
    field: "puppyPickPosition",
    value: StudPuppyPickPosition | null
  ): void;
  function updateTerm(
    field: "compensationType" | "puppyPickPosition",
    value: StudCompensationType | StudPuppyPickPosition | null
  ) {
    if (field === "compensationType" && !hasPuppyBack(value as StudCompensationType | null)) {
      setCurrentStepIndex((index) => adjustIndexAfterPuppyBackRemoval(index));
      setFurthestReachedStepIndex((index) =>
        adjustIndexAfterPuppyBackRemoval(index)
      );
    }

    setTerms((previousTerms) => {
      if (field === "compensationType") {
        return normalizeStudOfferTermsAfterChange(
          previousTerms,
          field,
          value as StudCompensationType | null
        );
      }

      return normalizeStudOfferTermsAfterChange(
        previousTerms,
        field,
        value as StudPuppyPickPosition | null
      );
    });
  }

  function goBack() {
    setCurrentStepIndex((index) => Math.max(0, index - 1));
  }

  function goNext() {
    setCurrentStepIndex((index) => {
      const nextIndex = Math.min(activeSteps.length - 1, index + 1);
      setFurthestReachedStepIndex((furthest) => Math.max(furthest, nextIndex));
      return nextIndex;
    });
  }

  function revisitStep(index: number) {
    if (index <= furthestReachedStepIndex) {
      setCurrentStepIndex(index);
    }
  }

  return (
    <section className="theme-panel mt-6 rounded-2xl p-5 sm:p-8" aria-labelledby="stud-offer-worksheet-title">
      <header>
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.2em]">
          Stud Offer
        </p>
        <h1 id="stud-offer-worksheet-title" className="theme-heading mt-2 text-3xl font-semibold">
          {STUD_OFFER_WORKSHEET_COPY.title}: {dogName}
        </h1>
        <p className="theme-copy mt-3 max-w-2xl">{STUD_OFFER_WORKSHEET_COPY.subtitle}</p>
      </header>

      <nav className="mt-8" aria-label="Stud offer worksheet progress">
        <p className="theme-label text-sm font-semibold" aria-live="polite">
          Step {currentStepIndex + 1} of {activeSteps.length}: {currentStep.name}
        </p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeSteps.map((step, index) => {
            const isCurrent = index === currentStepIndex;
            const isReached = index <= furthestReachedStepIndex;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => revisitStep(index)}
                  disabled={!isReached}
                  aria-current={isCurrent ? "step" : undefined}
                  className="theme-card w-full rounded-xl px-4 py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="block text-xs uppercase tracking-[0.14em]">Step {index + 1}</span>
                  <span className="mt-1 block">{step.name}</span>
                  <span className="theme-copy mt-1 block text-xs font-normal">
                    {isCurrent ? "Current step" : isReached ? "Visited step" : "Not reached"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="theme-card mt-6 rounded-2xl p-5" aria-labelledby={`worksheet-step-${currentStep.id}`}>
        <h2 id={`worksheet-step-${currentStep.id}`} className="theme-heading text-2xl font-semibold">
          {currentStep.name}
        </h2>
        <p className="theme-copy mt-3">{currentStep.description}</p>
        {currentStep.id === "review" ? (
          <p className="theme-status-info mt-5 rounded-xl p-4 text-sm font-semibold">
            {STUD_OFFER_WORKSHEET_COPY.publishingLater}
          </p>
        ) : (
          <p className="theme-copy mt-5 text-sm">
            {STUD_OFFER_WORKSHEET_COPY.futureStep}
          </p>
        )}
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={currentStepIndex === 0}
          className="theme-secondary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {STUD_OFFER_WORKSHEET_COPY.back}
        </button>
        {currentStepIndex < activeSteps.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="theme-primary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {STUD_OFFER_WORKSHEET_COPY.next}
          </button>
        ) : null}
      </div>
    </section>
  );
}
