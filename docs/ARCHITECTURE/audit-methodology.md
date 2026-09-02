# Architecture Audit Methodology

## Purpose and scope

This methodology governs the staged architecture sweep. The Master File describes what ShowRing means; architecture documentation records where ShowRing implements it. This is an internal engineering and audit artifact, not a classification of individual systems.

During discovery, production behavior is evidence of current implementation authority. Discovery records observations; it does not change gameplay, resolve product decisions, or establish a new source of truth.

## Classifications

### CANONICAL

The authoritative implementation or source of truth currently used by production behavior.

### DERIVED

Correctly computes or transforms information from a canonical source without becoming a second authority.

### PRESENTATION

Displays, formats, labels, or explains canonical/derived information without owning the underlying rule.

### INTENTIONAL VARIANT

Similar to another implementation but deliberately different because the context requires different behavior.

### DUPLICATE

Reimplements logic or ownership that should probably come from an existing canonical source.

### DIVERGENT

Two or more implementations of the same conceptual rule currently produce or can produce different behavior.

### LEGACY

Superseded or historical implementation retained for compatibility, migration, testing, or cleanup.

### UNKNOWN

Ownership or purpose cannot yet be established with sufficient evidence.

## Preservation rules for discovery

- Make no gameplay changes during discovery.
- Make no file moves.
- Make no broad refactors.
- Make no schema redesign.
- Do not clean up merely because two implementations look similar.
- Production behavior remains authoritative until deliberately changed.
- Do not consolidate similar code until intentional differences have been ruled out.
- Do not infer canonical ownership from file names alone.
- Do not treat newer code automatically as canonical.
- Do not treat duplication automatically as a defect.

## Evidence standard

Support each classification with repository evidence appropriate to the concept. Useful evidence includes:

- actual call paths;
- mutation paths;
- imports and consumers;
- service usage;
- rules-package usage;
- persistence reads and writes;
- cron or job invocation;
- focused tests;
- route behavior; and
- comments or documentation only when they match current code behavior.

Where evidence is insufficient, classify the concept as **UNKNOWN** rather than guessing.

## Authority standard

Audits must distinguish these authorities; they must not be assumed to be the same thing:

- **Design authority:** what the Master File says ShowRing should do.
- **Implementation authority:** what production currently executes.
- **Persistence authority:** where durable truth is stored.
- **Presentation authority:** where player-facing labels and display are defined.

## Conflict rule

If current production behavior conflicts with the Master File during discovery:

1. Record the discrepancy.
2. Do not silently change either source.
3. Do not decide which is correct during the architecture audit unless a later stage explicitly requests that decision.

## Reusable audit record

Use this record structure in later stages:

```text
Concept:
Classification:
Owning domain:
Evidence:
Current authority:
Consumers:
Related implementations:
Known differences:
Risk:
Notes:
Follow-up required:
```
