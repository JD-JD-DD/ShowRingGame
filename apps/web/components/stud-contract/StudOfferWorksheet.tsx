"use client";

import { useMemo, useState } from "react";
import {
  hasPuppyBack,
  MAX_STUD_CONTRACT_CASH_AMOUNT,
  normalizeStudOfferTermsAfterChange,
  requiresCash,
  validateStudContractCashAmount,
  validateStudOfferCompensationStep,
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
  compensationLegend: "Choose compensation",
  cashLabel: "Stud fee",
  cashHelp: "Enter a whole-dollar amount from $1 to $1,000,000.",
  cashMaximum: "Maximum cash compensation",
} as const;

const COMPENSATION_OPTIONS: ReadonlyArray<{
  value: StudCompensationType;
  label: string;
  description: string;
}> = [
  {
    value: "CASH",
    label: "Cash",
    description: "The dam owner pays a stud fee when the breeding is accepted and attempted.",
  },
  {
    value: "PUPPY_BACK",
    label: "Puppy Back",
    description: "The stud owner receives one puppy under the contract's later puppy-back terms.",
  },
  {
    value: "CASH_AND_PUPPY_BACK",
    label: "Cash + Puppy Back",
    description: "The dam owner pays a stud fee and the stud owner also receives one puppy under the later puppy-back terms.",
  },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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
  const [showCompensationErrors, setShowCompensationErrors] = useState(false);
  const [cashInputError, setCashInputError] = useState<string | null>(null);
  const activeSteps = useMemo(() => getActiveSteps(terms), [terms]);
  const currentStep = activeSteps[currentStepIndex] ?? activeSteps[0];
  const compensationValidation = validateStudOfferCompensationStep(terms);
  const cashValidation = validateStudContractCashAmount(terms.cashAmount);
  const cashError =
    cashInputError ??
    (showCompensationErrors && requiresCash(terms.compensationType)
      ? cashValidation.error?.message ?? null
      : null);

  function updateTerm(
    field: "compensationType",
    value: StudCompensationType | null
  ): void;
  function updateTerm(
    field: "puppyPickPosition",
    value: StudPuppyPickPosition | null
  ): void;
  function updateTerm(field: "cashAmount", value: number | null): void;
  function updateTerm(
    field: "compensationType" | "puppyPickPosition" | "cashAmount",
    value: StudCompensationType | StudPuppyPickPosition | number | null
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

      if (field === "puppyPickPosition") {
        return normalizeStudOfferTermsAfterChange(
          previousTerms,
          field,
          value as StudPuppyPickPosition | null
        );
      }

      return { ...previousTerms, cashAmount: value as number | null };
    });
  }

  function handleCashAmountChange(rawValue: string) {
    if (rawValue === "") {
      setCashInputError(null);
      updateTerm("cashAmount", null);
      return;
    }

    if (!/^\d+$/.test(rawValue)) {
      setCashInputError("Enter a whole-dollar amount.");
      return;
    }

    const amount = Number(rawValue);
    const validation = validateStudContractCashAmount(amount);
    if (!Number.isSafeInteger(amount)) {
      setCashInputError(
        validation.error?.message ?? "Enter a whole-dollar amount."
      );
      return;
    }

    if (!validation.valid) {
      setCashInputError(validation.error?.message ?? "Enter a valid stud fee.");
      updateTerm("cashAmount", amount);
      return;
    }

    setCashInputError(null);
    updateTerm("cashAmount", amount);
  }

  function goBack() {
    setCurrentStepIndex((index) => Math.max(0, index - 1));
  }

  function goNext() {
    if (currentStep.id === "compensation" && !compensationValidation.valid) {
      setShowCompensationErrors(true);
      return;
    }

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
        {currentStep.id === "compensation" ? (
          <fieldset
            className="mt-5 grid gap-3"
            aria-describedby={
              showCompensationErrors && !compensationValidation.valid
                ? "compensation-error"
                : undefined
            }
          >
            <legend className="theme-heading text-lg font-semibold">
              {STUD_OFFER_WORKSHEET_COPY.compensationLegend}
            </legend>
            {COMPENSATION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="theme-card flex cursor-pointer items-start gap-3 rounded-xl border p-4 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
              >
                <input
                  type="radio"
                  name="compensationType"
                  value={option.value}
                  checked={terms.compensationType === option.value}
                  onChange={() => {
                    setShowCompensationErrors(false);
                    setCashInputError(null);
                    updateTerm("compensationType", option.value);
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="theme-heading block text-base font-semibold">
                    {option.label}
                  </span>
                  <span className="theme-copy mt-1 block text-sm">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
            {showCompensationErrors &&
            !compensationValidation.valid &&
            !terms.compensationType ? (
              <p
                id="compensation-error"
                className="theme-status-danger rounded-xl p-3 text-sm"
                role="alert"
              >
                Choose a compensation type before continuing.
              </p>
            ) : null}

            {requiresCash(terms.compensationType) ? (
              <div className="mt-2 max-w-md">
                <label
                  htmlFor="stud-contract-cash-amount"
                  className="theme-heading block text-sm font-semibold"
                >
                  {STUD_OFFER_WORKSHEET_COPY.cashLabel}
                </label>
                <input
                  id="stud-contract-cash-amount"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={terms.cashAmount ?? ""}
                  onChange={(event) => handleCashAmountChange(event.target.value)}
                  aria-invalid={cashError ? true : undefined}
                  aria-describedby={
                    cashError
                      ? "stud-contract-cash-error"
                      : "stud-contract-cash-help"
                  }
                  className="dog-control mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <p
                  id="stud-contract-cash-help"
                  className="theme-copy mt-2 text-xs"
                >
                  {STUD_OFFER_WORKSHEET_COPY.cashHelp}{" "}
                  {STUD_OFFER_WORKSHEET_COPY.cashMaximum}: {currencyFormatter.format(MAX_STUD_CONTRACT_CASH_AMOUNT)}.
                </p>
                {terms.cashAmount !== null && cashValidation.valid ? (
                  <p className="theme-copy mt-2 text-sm">
                    Current stud fee: {currencyFormatter.format(terms.cashAmount)}.
                  </p>
                ) : null}
                {cashError ? (
                  <p
                    id="stud-contract-cash-error"
                    className="theme-status-danger mt-2 rounded-xl p-3 text-sm"
                    role="alert"
                  >
                    {cashError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : currentStep.id === "review" ? (
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
