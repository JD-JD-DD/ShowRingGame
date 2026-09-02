# Genetics Architecture

## Purpose

Maps hidden genetic state, phenotype, visible conformation categories, pedigree/COI, foundation interaction, and the judging boundary. The [Master File](../../PRODUCT/master-file.md) and controlling Post-Invitational source define intended design; this guide locates implementation responsibility.

## Domain Boundary

**Owns:** genetics/pedigree calculations, hidden-to-visible boundaries, phenotype/COI concepts, breed genetic context.  
**Consumes:** dogs, breed reference data, time/population state.  
**Exposes:** breeding inputs, permissible player-visible conformation information, and phenotype inputs to judging.

See [domains.md](../domains.md) for complete boundaries.

## Canonical Paths

- **Rules:** genetics, phenotype, COI, and related judging helpers in `packages/rules`.
- **Services:** breeding puppy-generation and foundation-generation integrations.
- **Persistence:** dog phenotype/genetics version data, pedigree relations, breed/background and judging-profile records where released.
- **Primary mutation routes:** canonical puppy creation and foundation generation only.
- **Scheduled progression:** annual/versioned breed-background processing where activated.
- **Presentation/read models:** dog/pedigree and player-facing conformation category mappers.

## Lifecycle / Flow

`parent/pedigree inputs → inheritance helper → hidden genetic state + phenotype → persisted dog/version context → derived visible categories → breed/judge interpretation → historical result`

## Cross-Domain Dependencies

- **Upstream:** Dogs, Breeds & Catalog, Calendar.
- **Downstream:** Breeding/Litters, Foundation Population, Judging, Health/COI consumers, dog/pedigree presentation.

## Historical / Persistence Invariants

Known phenotype, genetic/version context, pedigree and COI information must remain reconstructable. Migration/release work must preserve known legacy phenotype rather than rerolling it; published show history is never revised from newer genetic or breed data.

## Intentional Variants

- Hidden genotype/raw values versus player-evaluable categories.
- Directional conformation phenotype versus optimized Conditioning & Handling.
- Breed standard versus breed population versus breed genetic background.
- Current production behavior versus locked Post-Invitational release-scoped design.

## Known Architecture Debt

No standalone debt entry grants a new genetics authority. Review `ARCH-DEBT-006` when adding dog/show read models and the Master File discrepancy register before assuming a locked release package is live production behavior.

## Implementation Guidance

1. Read Genetics/Phenotype and Foundation sections of the Master File plus the controlling Post-Invitational source.
2. Never expose raw genotype or replace the canonical inheritance route.
3. Keep visible category mapping separate from judge scoring.
4. Preserve version/snapshot data and Decimal precision rules where activated.
5. Validate inheritance, presentation boundary, and historical-preservation behavior.

## References

[Master File](../../PRODUCT/master-file.md) · [canonical rules](../canonical-rules.md) · [canonical services](../canonical-services.md) · [data ownership](../data-ownership.md) · [dependency map](../dependency-map.md) · [patterns](../cross-cutting-patterns.md)
