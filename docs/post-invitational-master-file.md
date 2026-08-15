# ShowRing Game — Post-Invitational Genetics, Judging, Breed Release & Show Classes Development Master File

## Document Authority

This document is the controlling design and implementation specification for the ShowRing Game Post-Invitational Genetics, Judging, Breed Release, and Show Classes package.

Codex must read this document before performing work associated with any `GEN`, `JUDGE`, `BREED`, `CLASS`, or `RELEASE` implementation stage.

### Authority rules

* **LOCKED** decisions are requirements and must not be redesigned during implementation.
* **CALIBRATION** parameters have a locked architectural role, but their exact numeric values may be adjusted only through the designated simulation/calibration stages.
* **SCOPE LOCKED** decisions define what is and is not included in the current release package.
* **FUTURE / OUT OF SCOPE** systems must not be implemented unless a later explicitly scoped stage activates them.
* Existing production behavior must be preserved unless the active implementation stage explicitly changes it.
* If current production code conflicts with this specification, do not silently broaden implementation scope. Report the conflict.
* If older documentation, comments, notes, or planning files conflict with this MasterFile, this MasterFile controls the intended Post-Invitational design.
* Current production code remains authoritative for determining how the live system actually behaves before a stage changes it.
* Implementation should remain small, localized, staged, and independently auditable.
* Do not combine later stages merely because adjacent infrastructure is convenient to modify.

---

## 1. Purpose

This development package is a coordinated overhaul of several closely related ShowRing simulation systems:

* conformation genetics and inheritance;
* long-term breed-population genetics;
* foundation-dog genetics;
* decimal phenotype precision;
* breed-specific judging emphasis;
* judge preference interaction;
* judging auditability;
* show classes and class routing;
* new and revised breed reference data;
* coordinated post-Invitational activation.

The systems will be developed incrementally but held outside the production `main` branch until the complete package is ready for integrated testing.

The project is intentionally designed for long-term simulation stability.

ShowRing must remain genetically interesting over a game lifespan measured in decades, not merely through the first several generations.

Dogs may reach breeding age in approximately one real month. Genetic progression therefore must remain meaningful through pedigrees potentially reaching G100–G200 during a long-running game.

---

## 2. Release Strategy

### Development branch

All work in this package belongs on:

`feature/post-invitational-genetics-overhaul`

Normal Alpha maintenance and unrelated features continue on:

`main`

The overhaul branch should regularly receive current `main` changes so that it remains compatible with the live game.

The overhaul branch must not be merged into `main` until:

* all required release stages are implemented;
* component tests pass;
* integrated tests pass;
* genetics simulations meet agreed progression targets;
* breed judging data is complete;
* all release breeds have required supporting configuration;
* judging behavior is audited;
* class routing is audited;
* migrations are rehearsed;
* runtime activation controls are confirmed;
* the release boundary has been reached.

### Intended release boundary

Target activation:

**after the Invitational and before Week 1 of the following game cycle.**

This is the intended coordinated rules boundary.

### Runtime activation barrier

Where practical, infrastructure should be deployable without immediately changing gameplay.

Examples:

* hidden genotype may exist before puppy inheritance consumes it;
* decimal trait storage may exist before Model D is activated;
* breed judging profiles may exist before judging consumes them;
* show-class definitions may exist before entry routing changes;
* new breed rows may exist in development data without those breeds becoming player-selectable.

There are therefore two major safety barriers:

1. **Branch barrier** — incomplete work does not enter production `main`.
2. **Runtime barrier** — infrastructure can exist without activating new simulation behavior.

---

## 3. Alpha → Beta Validation Strategy

The new genetics model will first operate during Alpha.

After activation, Alpha testers should breed through several additional generations over approximately 3–6 months.

This period will gather population evidence for:

* phenotype improvement rate;
* allele/genotype fixation;
* litter variability;
* producer consistency;
* popular-sire effects;
* foundation usage;
* COI behavior;
* breed-population diversity;
* directional diversity around 10;
* extreme-quality dogs;
* rate of all-trait convergence;
* interaction between breed-specific judging and breeder selection.

The transition to Beta includes a full reset of the dog population.

Beta therefore begins with a clean genetic population generated under the revised foundation and inheritance systems.

Beta should provide approximately six additional months of population testing before release.

Final genetics tuning may occur from Beta evidence before public release.

Existing Alpha dogs are test-population records rather than permanent launch-population assets.

---

## 4. Core Genetic Philosophy

### Fixed ideal

All ten conformation phenotype traits use the canonical scale:

`0.000 – 20.000`

with:

`10.000 = ideal`

The scale remains directional.

Examples:

`9.500 = 0.500 under ideal`

`10.500 = 0.500 over ideal`

Both are equally distant from ideal.

Higher is never automatically better.

### Complementarity

Opposite-side phenotype values may complement one another.

Example:

`9.500 × 10.500`

is a meaningful complementary breeding.

The expected inherited direction may be centered closer to ideal, but ideal puppies are not guaranteed because offspring remain subject to:

* segregation;
* recombination;
* hidden genotype;
* litter variation;
* mutation;
* population-genetic effects.

### No hard perfection prohibition

An individual trait may equal exactly:

`10.000`

There is no arbitrary prohibition against an ideal trait.

Instead, the genetic architecture must make simultaneous near-perfection across all ten traits naturally rare.

### No moving-standard treadmill

Breed standards must not routinely change merely to prevent breeder progress.

Players who breed toward a published standard should not have that accomplishment invalidated because the game requires additional progression.

Three concepts remain distinct:

* **breed standard** — what judges want;
* **breed population** — what dogs currently are;
* **breed genetic background** — slow-moving population-genetic context.

---

## 5. Long-Term Progression Philosophy

Genetic progression should be approximately logarithmic.

### Early generations

Improvement should be noticeable.

Players should quickly learn that selective breeding works.

### Middle generations

Strong breeding programs should emerge.

Breeders should develop recognizable line strengths, producer patterns, and increased consistency.

### Mature generations

Large phenotype improvements become progressively more difficult.

Progress increasingly shifts toward:

* small phenotype gains;
* producer consistency;
* favorable allele combinations;
* fixation of selected characteristics;
* preservation of genetic diversity;
* intelligent outcrossing;
* balancing opposite-side phenotype.

### Very deep generations

Progress must remain possible.

It must never become literally zero.

Three-decimal precision allows gains such as:

`9.421 → 9.466`

to remain meaningful.

The long-term achievement is not merely producing a dog close to 10.

It is maintaining a population capable of repeatedly producing excellent dogs without exhausting the diversity required for further improvement.

---

## 6. Polygenic Architecture

### Selected target model

The working architecture is:

**40 simulated loci / 80 inherited allele values per dog**

Structure:

* 10 conformation phenotype traits;
* 4 diploid simulated loci per trait;
* 2 inherited allele values per locus;
* 40 loci total;
* 80 allele values total.

These loci are game abstractions representing polygenic inheritance.

They do not correspond one-for-one with named canine genes.

### Layer separation

The canonical architecture is:

**hidden genotype/loci**

→

**10 decimal phenotype traits**

→

**5 genetic/conformation judging categories**

plus

**Conditioning & Handling**

→

**breed-specific conformation emphasis**

→

**individual judge preference**

→

**small ring/day variance**

→

**placements**

Judging consumes phenotype.

Judging does not directly inspect hidden loci.

---

## 7. Genotype vs Phenotype

A dog's visible or persisted phenotype does not uniquely identify its genotype.

Two dogs may both have:

`Gait = 9.500`

while carrying substantially different underlying allele combinations.

One may carry relatively consistent alleles and reproduce its phenotype reliably.

Another may contain strongly mixed under/over allele contributions and produce much wider litters.

Therefore:

**excellent individual ≠ automatically excellent producer**

and:

**similar phenotype ≠ identical breeding value**

Producer quality should emerge through breeding history.

This is intentional gameplay.

---

## 8. Segregation and Recombination

Puppies inherit allele combinations from both parents.

Segregation and recombination must produce:

* meaningful littermate variation;
* hidden differences among similar-looking dogs;
* gradual fixation of favorable combinations;
* occasional regression from elite parents;
* occasional offspring better than both parents;
* line-specific consistency;
* producer differences.

Long-term genetic difficulty should primarily arise from:

* segregation;
* recombination;
* decreasing selectable genetic variance;
* diversity management;
* fixation difficulty;
* relatedness and bottlenecks.

The game should not primarily resist breeder progress through arbitrary quality penalties.

---

## 9. Decimal Genetic Precision

The current integer trait staircase will be removed.

Future phenotype values use Decimal persistence and support stable high-precision calculation.

Examples:

`8.135`

`8.395`

`8.713`

`8.884`

`9.041`

Existing integer dogs must preserve their current numerical phenotype exactly during migration.

Examples:

`8 → 8.000`

`9 → 9.000`

`10 → 10.000`

No existing Alpha dog should receive a rerolled phenotype merely because storage precision changes.

### Precision lock

Persisted conformation phenotype uses **Decimal**, not binary Float.

Phenotype calculations retain up to **six decimal places internally**.

Where phenotype-derived conformation values are intentionally exposed to players, the default detailed display precision is **three decimal places** unless an established UI requires a different presentation.

Intermediate inheritance calculations must not be rounded to player-visible precision before the calculation is complete.

Decimal precision:

* reduces integer clustering;
* removes large staircase jumps;
* supports gradual selection;
* supports measurable late-game improvement;
* improves simulation resolution.

---

## 10. Breed Genetic Background

### Purpose

Polygenic segregation alone is not expected to provide sufficient resistance to high-volume directional selection across G100–G200.

A mild breed genetic-background mechanism will therefore exist.

### Definition

Breed genetic background is:

* distributional;
* slow-moving;
* versioned;
* historically auditable;
* population based;
* separate from the breed standard.

It represents the current genetic environment of the breed population.

### It is not

It is not:

* a new breed standard;
* a hidden punishment for good dogs;
* automatic worsening of puppies;
* a fast-moving live average;
* a generation-based quality penalty.

### Snapshot model

Breed-background snapshots occur:

**once per game year, after the annual/Invitational cycle.**

This prevents:

* one popular sire from immediately moving the reference;
* short-term breeding bursts from changing expectations;
* unstable feedback loops;
* difficulty reproducing historic calculations.

### Reference population

The live breed-background reference population consists of living player-bred dogs of the breed that are part of the active breeding population.

Exclude:

* unsold/system foundation inventory;
* newly generated system dogs;
* deceased dogs;
* unreleased dogs.

Foundation dogs influence the population reference through player-bred descendants rather than through system inventory itself.

Safeguards must prevent one litter or one kennel from disproportionately defining the breed background.

A live population snapshot requires at minimum:

* **50 eligible dogs**, and
* **5 independent kennels**.

Below that threshold, retain the previous/versioned breed baseline rather than allowing a very small population to redefine the background.

---

## 11. Mutation

Mutation moves from phenotype-level mutation to hidden allele/component-level mutation.

Mutation is:

* rare;
* predominantly small;
* symmetrical around the inherited value;
* capable of introducing new variation;
* occasionally favorable;
* occasionally unfavorable.

Mutation maintains variation.

It is not the primary engine of genetic progress and must not become a reliable high-volume breeder strategy.

The exact mutation probability and effect distribution are **CALIBRATION parameters** and must be determined through long-horizon simulation rather than copied from the existing phenotype-level mutation system.

---

## 12. COI Integration

COI remains a diversity/inbreeding system rather than becoming a punishment for conformation quality.

In the initial polygenic model, COI may appropriately influence:

* homozygosity;
* segregation diversity;
* fixation risk;
* harmful recessive expression;
* fertility;
* health;
* survival;
* available genetic variance.

COI must not directly apply a generic conformation-quality penalty.

It must not function as:

> this dog is excellent, therefore its puppies are deliberately worse.

Exact numeric COI effects remain calibration/implementation decisions within this scope.

---

## 13. Popular Sires and Genetic Bottlenecks

Popular-sire concentration is a valid natural population pressure.

Stud Recovery already creates a logistical throttle.

Future breeding systems may create additional natural pressures.

The genetics system nevertheless must remain stable even when players concentrate successful sires aggressively.

Consequences should emerge naturally through:

* increased relatedness;
* reduced allele diversity;
* reduced outcross options;
* COI;
* fixation;
* loss of opposite-side variation;
* increased strategic value of unrelated stock.

A heavy-handed lifetime offspring cap will not be added solely to stop genetic advancement unless later evidence proves natural constraints insufficient.

---

## 14. Foundation Dogs — Long-Term Role

Foundation dogs are not merely starter stock.

They remain a permanent population-genetic tool.

Foundation dogs may provide:

1. phenotype complementarity;
2. hidden genetic distinctiveness;
3. anti-bottleneck diversity;
4. occasional strategic opportunity.

### Directional diversity rule

Foundation generation must preserve directional diversity around 10.

It must not only track closeness to the contemporary population mean.

Example breed population:

* Head `9.241`
* Forequarters `9.406`
* Hindquarters `9.511`
* Gait `9.608`
* Coat `9.332`

A useful foundation dog might have:

* Head `9.100`
* Forequarters `9.500`
* Hindquarters `9.300`
* Gait `11.120`
* Coat `9.200`

The `11.120` gait is not inherently superior.

Its value may be that it restores an opposite-side phenotype and genetically distinct alleles.

### Distributional generation

Foundation generation should consider:

* phenotype center;
* spread below 10;
* spread above 10;
* uncommon genetic components;
* components that have nearly disappeared;
* relatedness;
* genetic diversity;
* bottleneck state.

It should ask:

**How much directional variation exists?**

and:

**What variation is becoming scarce?**

However, the generator must not conveniently solve every shortage.

Population shortages may only weakly bias foundation generation.

---

## 15. Foundation Scarcity and Quality

Most foundation dogs should be:

* serviceable;
* genetically distinct;
* broadly adjacent to contemporary population quality;
* not obvious solutions.

Most foundation dogs should have no deliberately advantageous shortage match.

As a tuning target:

* approximately **15%** may carry one conspicuously useful directional/diversity opportunity;
* approximately **2%** may carry two.

These rates are generation targets, not player-visible tiers.

Multi-trait "breed repair" dogs should be effectively excluded.

### Long-term foundation quality

Foundation phenotype should follow the contemporary breed distribution while lagging elite player stock.

The system must not permanently use a simplistic rule such as:

`breed mean - 1`

Foundation quality may improve gradually as the breed population improves, but generated stock must not replace sustained player breeding.

The main late-game value of foundation stock should increasingly become:

* directional complementarity;
* uncommon genetic material;
* low relatedness;
* restoration of genetic diversity;

rather than superior show quality.

### Hidden distinctiveness

A foundation dog can remain valuable even when it is not an immediate show improvement.

Phenotypically ordinary stock may possess:

* uncommon allele combinations;
* low relatedness;
* opposite-side values;
* restored lost variation.

That creates the intended outcross tradeoff:

**short-term phenotype/consistency cost**

for

**long-term diversity and breeding opportunity**

Foundation pricing is a separate future economy issue.

---

## 16. Long-Horizon Population Targets

Initial tuning targets for elite breeder populations:

| Generation | Desired mean absolute deviation |
| ---------- | ------------------------------: |
| G3         |           approximately 2.0–2.4 |
| G10        |           approximately 1.2–1.7 |
| G20        |           approximately 0.8–1.3 |
| G50        |          approximately 0.45–0.9 |
| G100       |          approximately 0.30–0.7 |
| G200       |         approximately 0.20–0.55 |

These are tuning targets, not caps.

Individual dogs may be substantially better or worse.

The required behavior is:

* all-ten-trait near-perfection does not become routine;
* producer consistency remains important;
* diversity remains strategically relevant;
* each additional generation remains potentially worthwhile.

These bands may change during Alpha/Beta calibration without changing the locked architecture.

---

## 17. Judging Architecture — Locked Principles

Judging remains separate from inheritance.

The conceptual competition pipeline is:

**phenotype**

→

**breed interpretation/emphasis**

→

**five conformation judging categories**

plus

**Conditioning & Handling**

→

**judge preferences**

→

**presentation/conditioning effects**

→

**small ring/day variance**

→

**placements**

### Stable ideal

Competitive conformation continues to evaluate distance from ideal.

`10 = ideal`

`14` is not automatically better than `10`.

The existing production scoring model already respects this concept.

### Six judging categories

The judging model retains:

1. Type & Expression
2. Structure & Balance
3. Movement
4. Coat & Presentation
5. Temperament & Ring Behavior
6. Conditioning & Handling

The first five are phenotype/conformation categories.

Conditioning & Handling remains a distinct player-manageable presentation category.

### Player visibility

The ten transmissible phenotype traits remain hidden.

Players may receive detailed derived values for the five conformation/ring categories.

Where detailed numeric category values are intentionally exposed, they may display to three decimal places.

Conditioning & Handling retains its own existing presentation semantics and must not be represented as though it were inherited conformation.

---

## 18. Breed-Specific Judging Weights

Breed-specific emphasis will be added.

The purpose is to make breeds judge differently according to their distinguishing conformation priorities.

Breed weighting must not create single-score dominance.

Breed standard emphasis and individual judge preference are separate layers.

Conceptually:

**breed emphasis × judge preference**

→

**effective category emphasis**

Judge individuality must remain meaningful.

### Source data

The supplied breed forms contain:

* ten numeric descriptive conformation values;
* ten Suggested % values.

The **Suggested % values are the canonical source for breed-specific judging emphasis.**

The separate numeric values such as `7`, `8`, `9`, and `10`:

* are **not** breed-specific judging ideals;
* do **not** redefine the fixed ideal of 10;
* are **not** foundation baselines;
* are **not** judging scores.

They remain reference/descriptive source data only unless a later explicitly scoped system assigns them another documented purpose.

### Canonical weight input

Future import data uses ten explicitly named weight fields rather than one slash-delimited string:

* HeadWeight
* ForequartersWeight
* HindquartersWeight
* GaitWeight
* CoatWeight
* SizeWeight
* TemperamentWeight
* ShowShineWeight
* FeetWeight
* ToplineWeight

All ten fields are required.

Each weight must be numeric and `>= 0`.

The submitted total must equal:

**100.00 ± 0.01**

After validation, weights may be normalized internally to `1.0`.

Materially incorrect totals must be rejected rather than silently repaired.

### Overlap correction

Traits currently contribute to multiple judging categories.

Examples:

* forequarters → Structure and Movement;
* hindquarters → Structure and Movement;
* Show Shine → multiple categories.

A trait's source weight must represent its total breed-standard influence rather than being independently repeated in every mapped category.

Breed-weight calculation therefore requires overlap-aware allocation/normalization.

### Conditioning boundary

Breed conformation weights must not directly control Conditioning & Handling.

---

## 19. Breed Standard vs Breed Population

These concepts are permanently distinct.

### Breed standard

Defines what correct conformation means.

Stable.

The fixed ideal remains:

`10.000`

for all ten conformation traits.

Breed-specific judging differences come from **importance/emphasis**, not moving the ideal.

### Breed population

Describes contemporary dogs.

Dynamic.

May move toward or away from ideal.

### Breed genetic background

A slow-moving versioned population reference for inheritance/foundation systems.

It is not the breed standard.

Population improvement must never silently redefine what judges consider correct.

---

## 20. Breed Judging Profiles

The judging implementation should use a localized, versioned profile concept rather than hard-coded breed branches.

A future profile must at minimum support:

* `breedCode2`;
* profile/rules version;
* active/inactive state;
* ten explicit trait importance weights.

Recommended audit/provenance fields may include:

* source;
* notes.

The separate supplied 7–10 descriptive conformation values are not required for breed-weight judging and must not be imported as breed-standard targets.

Full production activation requires complete profiles for every breed participating in the activated judging system.

Missing profiles must not make a breed unjudgeable.

During staged development, any compatibility fallback must be:

* explicit;
* observable;
* equivalent to current neutral/default behavior;
* temporary.

---

## 21. Color / Genotype / Phenotype Rule Separation

Color genetics and conformation genetics remain separate systems.

Color/marking reference data may include:

* genotype rules;
* registry status;
* standard/allowed status;
* rule priority;
* phenotype description.

These must not automatically become conformation weights.

If a color, marking, or other phenotype later affects:

* conformation eligibility;
* DQ;
* Breed Essential;
* fault severity;

that must be introduced as an explicit judging-rule layer.

---

## 22. Breed Essential / Fault / DQ Layer

Breed Essential and conformation fault/DQ systems are **FUTURE / OUT OF SCOPE** for the initial breed-weight implementation.

The design contains concepts for:

* Breed Essential;
* penalties;
* elimination;
* disqualification.

These must not be silently bundled into basic breed-weight integration.

Breed Essential, when later implemented, should represent genuinely breed-defining requirements rather than functioning as another ordinary percentage weight.

Conformation faults and DQs require explicit breed rules and must not be inferred automatically from:

* ordinary conformation percentages;
* color genotype;
* standard/allowed color metadata.

---

## 23. Judge Preference

Individual judges retain persistent category preference profiles.

Judges should:

* differ meaningfully;
* remain reasonably bounded;
* develop recognizable tendencies;
* not become mathematically extreme.

Players may infer tendencies from experience and historical results.

Players must not receive exact hidden judge weights.

Breed emphasis defines what matters for the breed.

Judge preference defines how the individual judge emphasizes/interprets those categories.

Neither may eliminate the relevance of the other.

### Combination rule

Breed profiles establish baseline conformation emphasis.

Judge preferences modify that baseline multiplicatively.

After combination, the five effective conformation category weights are normalized back to a fixed conformation budget.

This prevents different breeds or judges from changing the total available score merely because their raw combined weights sum differently.

Conditioning & Handling retains its own separate budget and is not part of breed-conformation normalization.

---

## 24. Judging Auditability

Future judging should be more reproducible than the current system.

New judged results should contain enough version information to determine, where appropriate:

* scoring-rules version;
* breed judging profile/version;
* judge;
* relevant category/score breakdown;
* random seed or equivalent deterministic random inputs.

Historic results must not change because a later breed profile changes.

Existing published results remain historical facts and are not recalculated under the new system.

The exact persistence schema remains an implementation-stage decision.

---

## 25. New Breed Release Workstream

The modified `breeds.csv` is part of this coordinated release package.

New breeds must **not** become live merely because their rows exist in development data.

The breed workstream must cover:

* finalized `breeds.csv`;
* canonical `breedCode2`;
* canonical Group;
* release/version state;
* foundation-generation support;
* genotype/background support required by Model D;
* breed judging profile;
* required health configuration;
* color/phenotype configuration where applicable;
* show/class routing;
* market/search/filter visibility;
* breed-selector visibility;
* import validation.

### Complete-data release gate

**No breed may be included in the coordinated release unless it contains every piece of data required by every activated system in that release.**

A breed must not go live while missing, for example:

* judging weights;
* required Model D initialization/background configuration;
* required health data;
* Group;
* class routing compatibility.

---

## 26. Breed Group Changes — Production Migration Requirement

The modified `breeds.csv` changes the Group assignment of multiple existing breeds.

This is not merely a static-file change.

Existing production `Breed` records must be brought into alignment with the new canonical Group data.

### Deployment requirement

A **Prisma migration and/or controlled production data migration/update is required before coordinated activation.**

It must occur:

**between shows.**

Preferably:

* after the prior show block has fully completed;
* before the next relevant show cycle opens or judging begins;
* while affected background show-generation/judging work is not processing.

The Group migration must happen before activating:

* revised judging;
* revised class routing;
* newly released breeds.

### Accepted temporary Alpha consequence

Existing/pre-generated shows from the first several weeks after the migration may contain minor inconsistencies caused by breeds changing Groups.

This is accepted Alpha behavior.

We do **not** need to reconstruct historical shows solely to eliminate that temporary transition.

Preserve:

* already-published ShowResults;
* awards;
* points;
* titles;
* dog identities;
* breed assignments;
* pedigrees;
* completed show history.

Newly generated shows after the migration should use the new canonical Group assignments.

---

## 27. Show Classes

The show-class taxonomy and broad routing rules are now **LOCKED** for this package.

### Regular class taxonomy

Use the following compact regular-class structure:

* 6–9 Month Puppy;
* 9–12 Month Puppy;
* 12–18 Month;
* Bred-by-Exhibitor;
* Open.

Regular classes are divided by sex.

The game intentionally does not reproduce every optional real-world class.

### Non-champion eligibility

Non-champions enter one eligible regular class per show.

Age-specific classes are available according to age.

Where the player is also eligible for another valid class such as Bred-by-Exhibitor or Open, the entry workflow may permit an intentional class choice rather than forcing age-class routing.

Bred-by-Exhibitor requires the applicable breeder/owner relationship.

Open is available to otherwise eligible non-champions.

Exact class-selection UX remains an implementation/UI question.

### Champion routing

Champions bypass regular classes and enter Best of Breed competition.

They do not compete for Winners Dog or Winners Bitch.

### Veteran routing

Dogs become veteran-eligible according to the existing veteran-age rule.

Veteran is treated as a special/non-regular class.

Veteran eligibility does not silently override the existing maximum show-age rule.

Any future change allowing older dogs to continue showing specifically as veterans requires an explicit lifecycle-rule change.

### Award progression

Regular classes:

**class placement**

→

**Winners Dog / Winners Bitch**

→

**existing championship point calculation**

Then preserve the existing:

* Best of Winners;
* Best of Breed;
* Best of Opposite Sex;
* Select;
* Group;
* Best in Show;
* points;
* majors;
* CH/GCH logic;

except where an explicit class-integration stage requires localized routing changes.

---

## 28. International Accessibility and Localization Readiness

English remains the supported game language.

New player-facing text must use clear plain English.

Authentic dog-show terms may be used, but specialist terms should receive explanation/tooltips where appropriate.

Player-facing text should remain separate from simulation logic wherever practical.

Canonical enum/database values remain internal and untranslated.

Use locale-aware formatting for:

* dates;
* real-world timestamps;
* numbers;
* percentages;
* money.

Do not rely on ambiguous month/day/year formatting.

Accessibility requirements include:

* keyboard navigation;
* visible focus;
* semantic controls;
* proper labels;
* screen-reader labels;
* readable contrast;
* field-associated errors;
* state communication not dependent on color alone;
* layouts capable of handling longer future translated text.

Localization/accessibility work must not alter simulation rules unless explicitly required.

---

## 29. Development Method

Implementation remains small, surgical, and stage-based.

Each implementation stage should:

* have one clear objective;
* preserve unrelated systems;
* avoid broad refactors;
* add focused tests;
* include migration safety where applicable;
* be auditable independently;
* produce a file/change report.

Codex prompts should follow the established focused format.

Unrelated cleanup must not be folded into this project.

Stable implementation IDs are used instead of global stage numbers.

These IDs must remain stable even if additional stages are inserted later.

---

## 30. Implementation Plan

The following is the controlling implementation sequence.

Each stage should be its own focused implementation effort/commit wherever practical.

---

### Genetics Workstream

#### GEN-01 — Genotype Contract and Genetics Version

**Goal:** Lock the data and mathematical contract before changing storage or production behavior.

Define:

* 40 loci / 80 allele architecture;
* four diploid loci per phenotype trait;
* versioned compact genotype encoding;
* genetics version identifier;
* additive genotype → phenotype contract;
* six-decimal internal phenotype precision;
* bounded continuous allele-effect contract;
* deterministic test fixtures;
* legacy-genotype reconstruction contract.

No production inheritance activation.

No puppy behavior change.

**Gate:** We can deterministically calculate phenotype from a defined genotype representation.

---

#### GEN-02 — Decimal Phenotype Persistence

**Goal:** Remove integer trait storage limitations without changing existing dog quality.

Required behavior:

* persisted phenotype changes to Decimal;
* calculations support six-decimal internal precision;
* every existing integer phenotype preserves its exact numerical meaning;
* `8 → 8.000`;
* `10 → 10.000`;
* no rerolls;
* no change to breeding behavior yet;
* no change to judging meaning.

Audit all services/mappers/helpers that currently assume integers.

**Migration required:** yes.

**Gate:** Existing dogs retain numerically identical phenotype after migration.

---

#### GEN-03 — Legacy Hidden Genotype Initialization

**Goal:** Give existing Alpha dogs valid hidden genotype without altering phenotype.

Requirements:

* deterministic;
* reproducible;
* genetics-versioned;
* exact current phenotype wins;
* pedigree should influence hidden allele arrangement where possible;
* related dogs should be genetically coherent where phenotype preservation permits;
* two dogs with the same phenotype should not necessarily receive identical genotype;
* roots/unrelated dogs receive deterministic latent variation;
* no visible dog rerolls.

**Gate:** Every relevant legacy dog can produce a genotype that reproduces its known phenotype.

---

#### GEN-04 — Inactive Polygenic Inheritance Engine

**Goal:** Implement Model D inheritance without routing live puppy creation through it.

Implement pure/testable logic for:

* gamete formation;
* Mendelian segregation;
* independent segregation of the four loci assigned to each trait;
* allele inheritance;
* genotype assembly;
* additive genotype → phenotype calculation;
* rare small symmetric allele-level mutation;
* future COI/homozygosity hooks;
* breed-background input contract.

Do not activate production puppy creation.

Do not implement a chromosome/linkage simulator in v1.

Do not add dominance or epistasis unless later simulation demonstrates a specific need.

**Gate:** Deterministic engine tests pass and isolated simulated litters behave plausibly.

---

#### GEN-05 — Versioned Breed Genetic Background

**Goal:** Introduce the slow-moving population-genetic reference required by Model D.

Implement:

* annual versioned breed-background snapshot structure;
* living player-bred reference population;
* 50-dog/5-kennel minimum population rule;
* exclusion of system foundation inventory;
* distributional metrics;
* directional distribution around 10;
* relevant diversity/fixation metrics;
* snapshot identity/version;
* safeguards against one kennel/litter dominating the reference.

Do not redefine the breed standard.

**Gate:** A snapshot is stable, auditable, and reproducible.

---

#### GEN-06 — Long-Horizon Genetics Simulation and Calibration

**Goal:** Tune Model D before production activation.

Run repeated simulation across:

* G3;
* G10;
* G20;
* G50;
* G100;
* G200.

Test:

* normal breeder selection;
* aggressive high-volume selection;
* popular-sire concentration;
* bottlenecks;
* allele fixation;
* litter variance;
* exact-10 frequency;
* all-trait near-perfection frequency;
* foundation outcross intervention;
* 100–100,000 birth extreme-value behavior where useful.

Calibrate:

* allele-effect spread;
* mutation probability;
* mutation effect distribution;
* breed-background coefficient;
* other numeric parameters explicitly marked CALIBRATION.

Compare to the target MAD bands.

Tune only parameters justified by simulation.

**Gate:** Progress remains meaningful without routine population perfection.

---

#### GEN-07 — Reproductive Path Inheritance Parity

**Goal:** Ensure every puppy-creation route uses the same new genetics model.

Audit and align:

* ordinary whelping;
* emergency whelp survivors;
* any retry/recovery path;
* any deterministic emergency RNG shortcuts.

Emergency reproductive rules themselves must remain unchanged.

**Gate:** Puppy genetics no longer depend on which valid whelping code path created the puppy.

---

#### GEN-08 — Activate Model D for Future Puppies

**Goal:** Switch new puppy inheritance to Model D.

Preserve:

* existing dogs;
* existing phenotype;
* existing pedigrees;
* age/eligibility;
* pregnancy rules;
* cooldowns;
* health;
* economy.

Only puppies governed by the final activation boundary should consume the new inheritance model.

**Gate:** Production-style integration tests and controlled activation checks pass.

---

#### GEN-09 — Foundation Generation Alignment

**Goal:** Rebuild foundation genetics around the new population/genotype model.

Foundation generation should consider:

* contemporary phenotype distribution;
* direction below/above 10;
* hidden genotype diversity;
* low-frequency/lost components;
* bottleneck state;
* weak shortage bias;
* approximate 15% one-opportunity / 2% two-opportunity rarity targets;
* controlled rarity of useful outcross traits.

Do not generate direct solutions to breed weaknesses.

Do not routinely generate multi-trait repair dogs.

**Gate:** Foundation stock remains strategically useful without becoming superior to sustained player breeding.

---

### Judging Workstream

#### JUDGE-01 — Canonical Breed Judging Data Contract

**Goal:** Finalize input data before scoring implementation.

Required canonical import fields include:

* Breed;
* `breedCode2`;
* HeadWeight;
* ForequartersWeight;
* HindquartersWeight;
* GaitWeight;
* CoatWeight;
* SizeWeight;
* TemperamentWeight;
* ShowShineWeight;
* FeetWeight;
* ToplineWeight;
* RulesVersion;
* IsActive;
* source/notes as appropriate.

Group may remain an audit/reference field but is not itself a mathematical judging requirement.

Do not import slash-delimited Suggested % as the canonical machine format.

The separate supplied 7–10 descriptive values are not breed ideals and are not required by the breed-weight scoring model.

Validation:

* all ten weight fields present;
* numeric;
* each `>= 0`;
* total `100.00 ± 0.01`;
* reject materially invalid totals;
* normalize to `1.0` internally only after validation.

**Gate:** Every release breed can pass strict profile validation.

---

#### JUDGE-02 — Breed Judging Profile Persistence and Import

**Goal:** Store/version breed judging profiles without changing judging outcomes.

Requirements:

* localized profile persistence;
* versioning;
* active state;
* canonical breed relationship;
* exact validation;
* no silent missing-profile behavior;
* import tests.

Do not activate breed weighting.

**Gate:** Complete profile coverage can be audited before activation.

---

#### JUDGE-03 — Pure Breed-Weight Calculation

**Goal:** Implement the conformation-emphasis mathematics outside production judging.

Requirements:

* consume ten source trait weights;
* correct for category overlap;
* prevent duplicate amplification;
* preserve five conformation categories;
* exclude Conditioning & Handling;
* produce stable normalized internal contributions.

No production behavior change.

**Gate:** Mathematical tests prove source influence behaves as intended.

---

#### JUDGE-04 — Integrate Breed Emphasis × Judge Preference

**Goal:** Add breed-specific interpretation to production breed judging.

Conceptually:

**phenotype conformation**

× **breed emphasis**

× **judge preference**

Then normalize the five effective conformation categories to a fixed conformation budget.

Conditioning & Handling remains separate.

Preserve:

* existing ideal = 10 semantics;
* judge individuality;
* small day/ring variance;
* show eligibility;
* award logic;
* title logic;
* handler system;
* conditioning behavior.

**Gate:** Same dog/profile judged by different judges still produces meaningful judge differences; different breed profiles meaningfully change emphasis without dominating or changing the total score scale.

---

#### JUDGE-05 — Judging Persistence and Audit Versioning

**Goal:** Ensure new results remain historically interpretable.

Persist the smallest safe set of identifiers/inputs needed to determine:

* scoring version;
* breed profile/version;
* judge;
* relevant result breakdown;
* random/deterministic input where adopted.

Do not alter already-published historical results.

**Gate:** Future judging-rule changes cannot silently rewrite the meaning of old results.

---

#### JUDGE-06 — All-Breed Judging Validation

**Goal:** Validate judging across every breed intended for the release.

Test:

* profile completeness;
* weight totals;
* category overlap;
* edge-case breeds;
* judge variation;
* ideal semantics;
* conditioning independence;
* missing-profile safeguards;
* ranking stability;
* reasonable distribution of results.

**Gate:** No released breed is missing required judging configuration.

---

### Breed Release Workstream

#### BREED-01 — Finalize `breeds.csv`

**Goal:** Freeze canonical breed reference data for this package.

Validate:

* unique `breedCode2`;
* canonical breed names;
* canonical Groups;
* release states;
* no duplicate codes;
* no invalid Group values;
* new breeds clearly identified;
* existing breeds changing Groups clearly identified.

**Gate:** `breeds.csv` is release-candidate quality.

---

#### BREED-02 — New Breed Cross-System Coverage

**Goal:** Ensure every new breed is complete under all systems activated by this release.

Audit each new breed for:

* breed row;
* Group;
* release state;
* foundation/genotype support;
* judging profile;
* health requirements;
* color/phenotype rules where applicable;
* show/class behavior;
* market/search/filter support.

**Gate:** No partially configured breed can be activated.

---

#### BREED-03 — Breed/Group Data Migration

**Goal:** Prepare the production database for the revised canonical breed data.

Migration must:

* insert/update required breed records;
* update changed Group assignments;
* preserve `breedCode2`;
* preserve dogs and pedigrees;
* preserve historic results;
* not rewrite historical show records merely to match the new Group structure.

This migration must be rehearsed before release.

**Gate:** Development/staging database matches the finalized `breeds.csv`.

---

### Show Class Workstream

#### CLASS-01 — Current Show-Class and Award Routing Audit

**Goal:** Determine the exact production class/award flow before changing it.

Trace:

* entry eligibility;
* current class assignment if any;
* breed judging;
* Winners routes;
* BOB;
* Group;
* BIS;
* points;
* majors;
* champions;
* veterans.

Read-only first.

Compare production behavior against the locked class rules in Section 27.

**Gate:** Current production flow is fully documented and implementation gaps are identified.

---

#### CLASS-02 — Class Eligibility Contract

**Goal:** Translate the locked taxonomy from Section 27 into an exact implementation contract.

Define the server-authoritative eligibility/routing behavior for:

* 6–9 Month Puppy;
* 9–12 Month Puppy;
* 12–18 Month;
* Bred-by-Exhibitor;
* Open;
* sex division;
* champion BOB routing;
* Veteran special-class routing;
* Winners eligibility;
* advancement;
* points/majors interaction.

Do not redesign the taxonomy.

**Gate:** The locked rules can be expressed deterministically in code.

---

#### CLASS-03 — Class Assignment and Routing

**Goal:** Implement class eligibility/assignment without rewriting unrelated show systems.

Preserve existing show scheduling and judging architecture.

**Gate:** Entries deterministically route into the correct class.

---

#### CLASS-04 — Class Placements → Breed Awards/Points Integration

**Goal:** Feed class results into the existing award progression correctly.

Integrate:

* class placement;
* Winners Dog;
* Winners Bitch;
* breed competition;
* champions;
* points;
* majors.

Preserve existing BOW/BOB/BOS/Select/Group/BIS/title behavior except where explicitly required for class integration.

**Gate:** Existing title and points logic remains correct.

---

#### CLASS-05 — Show-Class Regression Validation

**Goal:** Run the complete class/award regression suite.

Include:

* age boundaries;
* sex;
* class eligibility;
* Bred-by eligibility;
* Open eligibility;
* champions;
* veterans;
* Winners;
* points;
* majors;
* BOB progression;
* Group/BIS progression.

---

### Release Integration Workstream

#### RELEASE-01 — Integrated Genetics + Judging + Breed + Class Audit

**Goal:** Test the package as a single simulation release.

Audit cross-system assumptions and ensure no stage has drifted from the MasterFile.

---

#### RELEASE-02 — Release-Candidate Long-Horizon Simulation

**Goal:** Run the final genetics simulation using the actual release implementation and final breed/judging contracts.

Confirm progression remains inside acceptable long-term ranges.

---

#### RELEASE-03 — Migration Rehearsal

**Goal:** Rehearse every production data/schema operation on a development/staging copy.

Include:

* decimal phenotype migration;
* genotype initialization;
* breed-profile data;
* breed/group updates;
* class-related schema changes if any.

Confirm rollback/recovery requirements.

---

#### RELEASE-04 — Runtime Activation Rehearsal

**Goal:** Prove that infrastructure can exist disabled and then activate cleanly at the intended boundary.

Runtime controls are server-side.

Use:

* one master Post-Invitational activation control;
* narrow subsystem controls where needed during development for genetics inheritance, breed judging, show classes, and new-breed release.

Production behavior must default to the pre-activation state until explicitly enabled.

Verify:

* old behavior before activation;
* new behavior after activation;
* no partial hybrid state.

---

#### RELEASE-05 — Final Branch Sync and Pull Request Audit

**Goal:** Bring current `main` into the overhaul branch and inspect the full accumulated change set.

Run the complete validation suite.

No unrelated feature work should enter through this merge.

---

#### RELEASE-06 — Production Breed Migration Between Shows

**Goal:** Update production Breed data before activating the package.

Hard operational requirement:

**Perform the Group/breed migration between shows.**

Checklist:

* previous relevant show processing complete;
* no affected judging job executing;
* no affected show-generation job partially running;
* migration/data update applied;
* Breed records compared to finalized `breeds.csv`;
* duplicate codes checked;
* Group mappings checked;
* new breeds remain release-gated until activation.

Temporary inconsistencies in already generated future Alpha shows are accepted.

Historical results are not rewritten.

---

#### RELEASE-07 — Merge to `main`

Merge only after:

* migrations have been rehearsed;
* integrated validation passes;
* release profile coverage is complete;
* activation controls are confirmed;
* the intended release boundary has arrived.

---

#### RELEASE-08 — Coordinated Post-Invitational Activation

**Goal:** Activate the coordinated package.

Activation order:

1. deploy inactive infrastructure;
2. complete required migrations/data validation between shows;
3. verify production state;
4. confirm the Invitational is complete and Week 1 has not begun;
5. activate Model D inheritance;
6. activate revised foundation behavior;
7. activate breed-specific judging;
8. activate show classes;
9. activate new/revised breed release behavior;
10. force or verify appropriate future show-schedule generation under the new Group/class rules;
11. immediately begin post-activation verification.

Never activate the coordinated package before the Breed/Group migration has completed successfully.

---

#### RELEASE-09 — Post-Activation Audit

Immediately verify:

* puppy genetics;
* foundation inventory;
* breed judging;
* judge variation;
* class routing;
* Group assignments;
* new breed visibility;
* show generation;
* points/majors;
* runtime jobs;
* logs/errors.

Then continue Alpha population monitoring.

---

## 31. Data and Migration Gates

Before coordinated release, all of the following must be true:

* decimal phenotype migration tested;
* legacy genotype initialization tested;
* every release breed has valid breed configuration;
* every release breed has judging profile coverage;
* `breedCode2` uniqueness verified;
* Group changes enumerated;
* production breed migration rehearsed;
* no missing judging profile silently defaults without an explicit compatibility rule;
* no new breed becomes active merely because a data row exists;
* published ShowResults remain untouched.

---

## 32. Locked Decisions and Calibration Parameters

| Decision                                   | Status                    | Locked decision                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Genotype encoding/storage                  | **LOCKED**                | Store a versioned compact genotype representation per dog containing 40 diploid loci / 80 allele values. Do not create 80 independent Prisma columns. Keep access behind rules-layer helpers and version with `geneticsVersion`. |
| Phenotype persistence                      | **LOCKED**                | Persist the ten conformation phenotype values using Decimal rather than binary Float.                                                                                                                                            |
| Internal phenotype precision               | **LOCKED**                | Calculate/store phenotype to six decimal places internally. Use three decimals for detailed player-visible derived conformation values where appropriate.                                                                        |
| Ten phenotype traits visible to players    | **LOCKED**                | No. Keep the ten transmissible phenotype traits hidden.                                                                                                                                                                          |
| Player-visible decimal conformation values | **LOCKED**                | The five derived conformation/ring categories may display to three decimals where appropriate. Conditioning & Handling retains its own presentation semantics.                                                                   |
| Genotype → phenotype architecture          | **LOCKED**                | Four diploid loci / eight allele contributions feed each phenotype trait. Use an additive base model centered on fixed ideal 10. Breed background must not move the phenotype ideal.                                             |
| Allele-effect distribution                 | **CALIBRATION**           | Continuous, symmetric around neutral, bounded, predominantly modest effects. Exact spread is tuned through simulation.                                                                                                           |
| Recombination/segregation                  | **LOCKED**                | Mendelian segregation: each parent contributes one allele per locus. Treat loci as independently segregating in v1. No chromosome/linkage simulator.                                                                             |
| Mutation architecture                      | **LOCKED**                | Mutation occurs at allele/component level and is rare, symmetric and usually small.                                                                                                                                              |
| Mutation rate/effect size                  | **CALIBRATION**           | Exact probability and effect distribution are tuned through long-horizon simulation.                                                                                                                                             |
| Breed-background role                      | **LOCKED**                | Mild population-genetic context, never the breed standard and never the primary inheritance force.                                                                                                                               |
| Breed-background coefficient               | **CALIBRATION**           | Exact strength is tuned against G50/G100/G200 outcomes.                                                                                                                                                                          |
| Background snapshot cadence                | **LOCKED**                | Once per game year after the annual/Invitational cycle.                                                                                                                                                                          |
| Snapshot reference population              | **LOCKED**                | Living player-bred dogs in the active breeding population. Exclude system foundation inventory, deceased dogs and unreleased dogs. Foundation stock enters the signal through descendants.                                       |
| Minimum live-background population         | **LOCKED**                | At least 50 eligible dogs and 5 independent kennels. Otherwise retain the prior/versioned baseline.                                                                                                                              |
| Legacy pedigree/genotype reconstruction    | **LOCKED**                | Use pedigree where possible for genetic coherence, but exact phenotype preservation always wins.                                                                                                                                 |
| COI and loci                               | **SCOPE LOCKED**          | COI may affect homozygosity, segregation diversity and existing health/fertility systems. It does not apply a generic conformation penalty.                                                                                      |
| Foundation shortage bias                   | **LOCKED**                | Weak probabilistic bias only. Never deterministic breed repair.                                                                                                                                                                  |
| Foundation strategic-opportunity rarity    | **LOCKED**                | Approximate generation target: 15% with one conspicuously useful opportunity, 2% with two. Multi-trait repair dogs effectively excluded.                                                                                         |
| Foundation quality vs population           | **LOCKED**                | Follow contemporary breed distribution while lagging elite player stock. Late-game value shifts toward directionality and genetic distinctiveness.                                                                               |
| Supplied 7–10 breed conformation values    | **LOCKED**                | Reference/descriptive source data only. They are not breed ideals, judging targets or foundation baselines unless a separate future system explicitly assigns them another documented purpose.                                   |
| Suggested % breed values                   | **LOCKED**                | These are the canonical source for breed-specific judging emphasis.                                                                                                                                                              |
| Breed-weight import validation             | **LOCKED**                | Ten explicit nonnegative weights; total must equal 100.00 ± 0.01; normalize to 1.0 only after validation.                                                                                                                        |
| Breed Essential                            | **FUTURE / OUT OF SCOPE** | Separate later judging-rule system. Do not implement as part of breed-weight integration.                                                                                                                                        |
| Conformation fault/DQ system               | **FUTURE / OUT OF SCOPE** | Separate later judging-rule system. Do not infer DQs/faults from ordinary weights or color/genotype data.                                                                                                                        |
| Judge × breed weighting                    | **LOCKED**                | Breed baseline emphasis × judge preference, then normalize the five conformation category weights to a fixed conformation budget. Conditioning & Handling remains separate.                                                      |
| Regular class taxonomy                     | **LOCKED**                | 6–9 Month Puppy, 9–12 Month Puppy, 12–18 Month, Bred-by-Exhibitor and Open, divided by sex.                                                                                                                                      |
| Non-champion class eligibility             | **LOCKED**                | One eligible regular class per show. Valid alternative class choice may be offered where rules permit.                                                                                                                           |
| Champion routing                           | **LOCKED**                | Champions bypass regular classes and enter Best of Breed competition.                                                                                                                                                            |
| Veteran routing                            | **LOCKED**                | Veteran is a special/non-regular class using the existing veteran threshold and does not silently override maximum show age.                                                                                                     |
| Class → points/majors                      | **LOCKED**                | Class winners feed Winners Dog/Winners Bitch, then existing championship points/majors and BOW/BOB/BOS progression.                                                                                                              |
| Feature-flag architecture                  | **LOCKED**                | Server-side controls only. Use one master activation control plus narrow subsystem controls where useful during development. Default off until coordinated activation.                                                           |
| Operational activation                     | **LOCKED**                | Deploy inactive infrastructure → migrate/validate between shows → verify production → activate after Invitational and before Week 1 → verify future show generation → immediate post-activation audit.                           |

### Calibration rule

The architecture above is locked.

Changing a value explicitly marked **CALIBRATION** after simulation evidence does not constitute a redesign of the Post-Invitational architecture.

Changing a **LOCKED** architectural decision requires an explicit MasterFile revision.

---

## 33. Hard Preservation Rules

Unless a stage explicitly requires otherwise, preserve:

* dog identity;
* registration numbers;
* pedigrees;
* ownership;
* kennel runs;
* call names;
* registered names;
* breeding eligibility ages;
* dam cooldown;
* stud recovery;
* pregnancy timing;
* reproductive emergencies;
* health-test outcomes;
* mortality;
* economy;
* market ownership;
* show scheduling;
* handler logic;
* conditioning;
* title history;
* published results;
* player-written content;
* routes.

Existing Alpha dogs must not have their known phenotype silently rerolled.

Decimal migration preserves numeric values.

Legacy genotype generation preserves known phenotype.

Breed Group migration preserves dogs, pedigrees, awards, points, and published show history.

---

## 34. Canonical Architecture Lock

The working target architecture is:

**40 hidden simulated loci / 80 inherited allele values**

→

**10 hidden Decimal directional conformation phenotype traits centered on fixed ideal 10**

→

**5 player-evaluable phenotype/conformation judging categories**

plus

**Conditioning & Handling as an independent sixth category**

→

**breed-specific conformation emphasis**

→

**individual judge preference**

→

**small ring/day variance**

→

**show placements**

Inheritance additionally interacts with:

* segregation;
* recombination;
* mild allele-level mutation;
* COI;
* slow-moving versioned breed genetic-background distributions.

Foundation generation additionally interacts with:

* contemporary phenotype distribution;
* directional diversity below/above 10;
* genotype diversity;
* bottleneck state;
* controlled scarcity of useful outcross stock.

Breed identity/reference data interacts with:

* foundation generation;
* genetics configuration;
* judging profiles;
* Group/class routing;
* health configuration;
* color/phenotype rules;
* market and selector availability.

The system must support:

* noticeable early advancement;
* progressively smaller later gains;
* meaningful differences among producers;
* strategic diversity management;
* continued measurable progress over a multi-decade simulation;
* extremely rare all-trait near-perfection rather than arbitrary caps.

---

## 35. Production Deployment Note — Breed/Group Migration

**This is a mandatory deployment note for the Post-Invitational package.**

The revised `breeds.csv` contains:

* new breeds; and
* Group changes for multiple existing breeds.

Before production activation:

1. Finalize `breeds.csv`.
2. Identify every changed `breedCode2 → Group` mapping.
3. Prepare the required Prisma/data migration.
4. Test the migration against a non-production database.
5. Confirm no duplicate `breedCode2`.
6. Confirm all Group values are valid.
7. Confirm every new breed has complete release data.
8. Confirm affected show/judging background jobs are idle.
9. Execute the migration **between shows**.
10. Verify production Breed records against the canonical CSV.
11. Activate the coordinated package only after verification.

Known and accepted Alpha consequence:

**The first several weeks of previously generated shows may contain minor inconsistencies with the new Group assignments.**

That is acceptable.

Do not rebuild completed shows.

Do not recalculate published results.

Do not rewrite awards, points, titles, or history.

Newly generated shows should naturally converge onto the new canonical Group structure.

---

## 36. Release Definition of Done

The Post-Invitational package is ready only when:

* Model D genetics is implemented and calibrated;
* decimal phenotype migration is safe;
* legacy genotype initialization preserves current dogs;
* all puppy-generation routes use the same inheritance model;
* foundation generation is aligned to the new genetics architecture;
* breed background is versioned and auditable;
* breed judging profiles are complete;
* overlap-safe breed weighting is validated;
* judge individuality remains meaningful;
* Conditioning & Handling remains independent;
* judging results contain adequate version information;
* `breeds.csv` is final;
* every release breed has complete cross-system data;
* Group migration is rehearsed;
* class taxonomy and routing are implemented and tested;
* points/majors/title regression passes;
* integrated simulation passes;
* migration rehearsal passes;
* runtime activation rehearsal passes;
* branch diff is reviewed;
* production breed migration occurs between shows;
* activation occurs at the post-Invitational/pre-Week-1 boundary.
