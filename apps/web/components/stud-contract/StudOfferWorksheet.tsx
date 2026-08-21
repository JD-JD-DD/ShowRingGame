"use client";

import { useMemo, useState } from "react";
import {
  hasPuppyBack,
  getAllowedMinimumLitterSizes,
  MAX_STUD_CONTRACT_CASH_AMOUNT,
  normalizeStudOfferTermsAfterChange,
  requiresCash,
  validateStudContractCashAmount,
  validateStudOfferCompensationStep,
  validateStudOfferPuppyBackTermsStep,
  type EditableStudOfferTerms,
  type StudCompensationType,
  type StudPuppyPickPosition,
  type StudPuppySexRequirement,
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

const PUPPY_BACK_COPY = {
  pickLegend: "Pick Position",
  sexLegend: "Required Sex",
  litterLegend: "Minimum Qualifying Litter",
  firstPick: "First Pick",
  secondPick: "Second Pick",
  either: "Either",
  male: "Male",
  female: "Female",
  secondPickMinimum:
    "Second Pick requires at least 2 surviving puppies because the dam owner receives the first protected selection.",
  litterDefinition:
    "Minimum litter size is the number of surviving puppies at the contract's litter-qualification checkpoint.",
  timingTitle: "How Puppy Selection Works",
  timing:
    "Selection begins after the Week 1 neonatal mortality window closes and takes place during the puppies' first eight weeks of life. Each active selection turn lasts 24 real hours.",
  noAutomatic:
    "The game will never automatically select a puppy on behalf of either kennel.",
  forfeiture:
    "Failure to exercise a puppy-selection right before its deadline forfeits that selection right.",
  selectedDeath:
    "If a selected contract puppy dies before transfer while the selection window remains open, the stud owner may choose again from remaining qualifying puppies under the same pick, sex, and contract terms. If no qualifying replacement exists, the puppy-back portion is unfulfilled without automatic cash substitution or contract error.",
  unavailableSex:
    "Sex is a requirement, not a preference. If the required sex is unavailable, the game does not substitute another sex or cash; the contract remains valid.",
  returnService:
    "A missed selection, unavailable sex, or unfulfilled puppy-back portion does not by itself create return service. Return service depends only on separately configured litter-size terms.",
} as const;

const PICK_OPTIONS: ReadonlyArray<{
  value: StudPuppyPickPosition;
  label: string;
  description: string;
}> = [
  {
    value: "FIRST",
    label: PUPPY_BACK_COPY.firstPick,
    description:
      "The stud owner makes the first contractual puppy selection after the Week 1 neonatal window closes.",
  },
  {
    value: "SECOND",
    label: PUPPY_BACK_COPY.secondPick,
    description:
      "The dam owner receives one protected first selection. Their 24-real-hour turn is unrestricted by this contract's sex requirement; then the stud owner's turn opens. If the dam owner misses the deadline, that protected pick is forfeited and the stud owner's turn opens.",
  },
];

const SEX_OPTIONS: ReadonlyArray<{
  value: StudPuppySexRequirement;
  label: string;
  description: string;
}> = [
  { value: "EITHER", label: PUPPY_BACK_COPY.either, description: "The stud owner may select a puppy of either sex." },
  { value: "MALE", label: PUPPY_BACK_COPY.male, description: "The stud owner may select only a male puppy." },
  { value: "FEMALE", label: PUPPY_BACK_COPY.female, description: "The stud owner may select only a female puppy." },
];

const MINIMUM_LITTER_OPTIONS = [1, 2, 3] as const;

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
  const [showPuppyBackErrors, setShowPuppyBackErrors] = useState(false);
  const [cashInputError, setCashInputError] = useState<string | null>(null);
  const activeSteps = useMemo(() => getActiveSteps(terms), [terms]);
  const currentStep = activeSteps[currentStepIndex] ?? activeSteps[0];
  const compensationValidation = validateStudOfferCompensationStep(terms);
  const puppyBackValidation = validateStudOfferPuppyBackTermsStep(terms);
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
    field: "puppySex",
    value: StudPuppySexRequirement | null
  ): void;
  function updateTerm(field: "minimumLitterSize", value: number | null): void;
  function updateTerm(
    field:
      | "compensationType"
      | "puppyPickPosition"
      | "cashAmount"
      | "puppySex"
      | "minimumLitterSize",
    value:
      | StudCompensationType
      | StudPuppyPickPosition
      | StudPuppySexRequirement
      | number
      | null
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

      if (field === "cashAmount") {
        return { ...previousTerms, cashAmount: value as number | null };
      }

      if (field === "puppySex") {
        return {
          ...previousTerms,
          puppySex: value as StudPuppySexRequirement | null,
        };
      }

      return {
        ...previousTerms,
        minimumLitterSize: value as number | null,
      };
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
    if (currentStep.id === "puppy-back" && !puppyBackValidation.valid) {
      setShowPuppyBackErrors(true);
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

  function puppyBackFieldError(field: string): string | null {
    if (!showPuppyBackErrors) return null;
    return (
      puppyBackValidation.errors.find((error) => error.field === field)
        ?.message ?? null
    );
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
        ) : currentStep.id === "puppy-back" ? (
          <div className="mt-5 grid gap-6">
            <fieldset
              aria-describedby={
                puppyBackFieldError("puppyPickPosition")
                  ? "puppy-pick-error"
                  : undefined
              }
            >
              <legend className="theme-heading text-lg font-semibold">
                {PUPPY_BACK_COPY.pickLegend}
              </legend>
              <p className="theme-copy mt-2 text-sm">
                Pick position means selection order, not puppy quality.
              </p>
              <div className="mt-3 grid gap-3">
                {PICK_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="theme-card flex cursor-pointer items-start gap-3 rounded-xl border p-4 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
                  >
                    <input
                      type="radio"
                      name="puppyPickPosition"
                      value={option.value}
                      checked={terms.puppyPickPosition === option.value}
                      onChange={() => {
                        setShowPuppyBackErrors(false);
                        updateTerm("puppyPickPosition", option.value);
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
              </div>
              {puppyBackFieldError("puppyPickPosition") ? (
                <p
                  id="puppy-pick-error"
                  className="theme-status-danger mt-3 rounded-xl p-3 text-sm"
                  role="alert"
                >
                  {puppyBackFieldError("puppyPickPosition")}
                </p>
              ) : null}
            </fieldset>

            <fieldset
              aria-describedby={
                puppyBackFieldError("puppySex")
                  ? "puppy-sex-error"
                  : undefined
              }
            >
              <legend className="theme-heading text-lg font-semibold">
                {PUPPY_BACK_COPY.sexLegend}
              </legend>
              <p className="theme-copy mt-2 text-sm">
                Sex is a requirement, not a preference. The game does not substitute another sex automatically.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {SEX_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="theme-card flex cursor-pointer items-start gap-3 rounded-xl border p-4 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
                  >
                    <input
                      type="radio"
                      name="puppySex"
                      value={option.value}
                      checked={terms.puppySex === option.value}
                      onChange={() => {
                        setShowPuppyBackErrors(false);
                        updateTerm("puppySex", option.value);
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
              </div>
              {puppyBackFieldError("puppySex") ? (
                <p
                  id="puppy-sex-error"
                  className="theme-status-danger mt-3 rounded-xl p-3 text-sm"
                  role="alert"
                >
                  {puppyBackFieldError("puppySex")}
                </p>
              ) : null}
            </fieldset>

            <fieldset
              aria-describedby={
                puppyBackFieldError("minimumLitterSize")
                  ? "minimum-litter-error"
                  : undefined
              }
            >
              <legend className="theme-heading text-lg font-semibold">
                {PUPPY_BACK_COPY.litterLegend}
              </legend>
              <p className="theme-copy mt-2 text-sm">
                {PUPPY_BACK_COPY.litterDefinition}
              </p>
              {terms.puppyPickPosition === "SECOND" ? (
                <p className="theme-status-info mt-3 rounded-xl p-3 text-sm">
                  {PUPPY_BACK_COPY.secondPickMinimum}
                </p>
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {MINIMUM_LITTER_OPTIONS.map((minimum) => {
                  const isAllowed =
                    terms.puppyPickPosition === null ||
                    getAllowedMinimumLitterSizes(
                      terms.puppyPickPosition
                    ).includes(minimum);

                  return (
                    <label
                      key={minimum}
                      className="theme-card flex items-center gap-3 rounded-xl border p-4 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55"
                    >
                      <input
                        type="radio"
                        name="minimumLitterSize"
                        value={minimum}
                        checked={terms.minimumLitterSize === minimum}
                        disabled={!isAllowed}
                        onChange={() => {
                          setShowPuppyBackErrors(false);
                          updateTerm("minimumLitterSize", minimum);
                        }}
                      />
                      <span>{minimum}+</span>
                    </label>
                  );
                })}
              </div>
              {puppyBackFieldError("minimumLitterSize") ? (
                <p
                  id="minimum-litter-error"
                  className="theme-status-danger mt-3 rounded-xl p-3 text-sm"
                  role="alert"
                >
                  {puppyBackFieldError("minimumLitterSize")}
                </p>
              ) : null}
            </fieldset>

            <section className="theme-status-info rounded-xl p-4" aria-labelledby="puppy-selection-rules-title">
              <h3 id="puppy-selection-rules-title" className="theme-heading text-lg font-semibold">
                {PUPPY_BACK_COPY.timingTitle}
              </h3>
              <div className="theme-copy mt-3 grid gap-3 text-sm leading-6">
                <p>{PUPPY_BACK_COPY.timing}</p>
                <p className="font-semibold">{PUPPY_BACK_COPY.noAutomatic}</p>
                <p>{PUPPY_BACK_COPY.forfeiture}</p>
                <p>
                  For Second Pick, the dam owner has the protected first 24-real-hour turn. If they select, the stud owner's turn opens immediately. If they miss it, their right is forfeited and the stud owner's turn opens with no puppy automatically selected.
                </p>
                <p>
                  If the stud owner misses their turn, the puppy-back right is forfeited. No puppy is assigned, no penalty payment is generated solely for the missed selection, and no automatic cash substitute applies.
                </p>
              </div>
            </section>

            <section className="theme-card rounded-xl p-4" aria-labelledby="puppy-contract-rules-title">
              <h3 id="puppy-contract-rules-title" className="theme-heading text-lg font-semibold">
                Important Contract Rules
              </h3>
              <div className="theme-copy mt-3 grid gap-3 text-sm leading-6">
                <p>{PUPPY_BACK_COPY.unavailableSex}</p>
                <p>{PUPPY_BACK_COPY.selectedDeath}</p>
                <p>{PUPPY_BACK_COPY.returnService}</p>
              </div>
            </section>
          </div>
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
