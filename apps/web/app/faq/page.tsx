import Link from "next/link";

const faqSections = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is ShowRing?",
        answer:
          "ShowRing is a realistic dog show and breeding simulation where you build and manage your own kennel, purchase foundation dogs, breed future generations, and grow a reputation over time.",
      },
      {
        question: "How do I start my kennel?",
        answer:
          "Begin by creating an account, setting up your kennel, and purchasing foundation dogs from the market. Foundation dogs give you the starting point for your first breeding program.",
      },
      {
        question: "What is the best beginner strategy?",
        answer:
          "Start with one breed, buy a small number of dogs, learn visible category strengths, breed thoughtfully, and plan for future generations.",
      },
    ],
  },
  {
    title: "Time and Aging",
    items: [
      {
        question: "How does time work?",
        answer:
          "One real-life hour equals one in-game day. Seven real-life hours equal one in-game week, and 365 real-life hours equal one in-game year.",
      },
      {
        question: "How old does a dog need to be to show?",
        answer:
          "Dogs become show eligible at approximately six months of in-game age.",
      },
      {
        question: "How old does a dog need to be to breed?",
        answer:
          "Dogs become breeding eligible at approximately two years of in-game age. Female dogs eventually age out of breeding, while males may continue later in life.",
      },
      {
        question: "Do dogs age and die?",
        answer:
          "Yes. Dogs naturally age over time, eventually retire from showing, and later face age-related mortality risk.",
      },
    ],
  },
  {
    title: "Dogs and Genetics",
    items: [
      {
        question: "Are dog stats random?",
        answer:
          "Every dog has hidden inherited traits that influence movement, structure, temperament, coat quality, ring presence, and more. Puppies inherit from both parents with natural variation.",
      },
      {
        question: "Can I see hidden genetics?",
        answer:
          "No. Players see visible show categories instead of exact genetic values. Learning your bloodlines over time is part of the strategy.",
      },
      {
        question: "Are foundation dogs all the same quality?",
        answer:
          "No. Some foundation dogs have standout strengths, while others have weaknesses that require careful breeding decisions to improve.",
      },
      {
        question: "Why do judges disagree?",
        answer:
          "Judges can value different things. A dog that does well under a movement-focused judge may not perform the same under a judge who weighs type, structure, or presentation differently.",
      },
    ],
  },
  {
    title: "Breeding",
    items: [
      {
        question: "How does breeding work?",
        answer:
          "Select an eligible sire and dam, submit a breeding attempt, wait for the pregnancy check, and if successful, wait for gestation. Puppies are born into your kennel.",
      },
      {
        question: "How long does pregnancy take?",
        answer:
          "Pregnancy checks occur after roughly 30 in-game days, and puppies arrive after roughly 60 in-game days total. Since one real hour equals one game day, that timing is also about 30 and 60 real hours.",
      },
      {
        question: "Are litter sizes always the same?",
        answer:
          "No. Litters vary naturally in size. Some may be small, while others may be much larger.",
      },
      {
        question: "Can I breed related dogs?",
        answer:
          "Different strategies are possible, but close breeding may carry risks and consequences over time. Bloodline management is an advanced part of kennel strategy.",
      },
    ],
  },
  {
    title: "Health Testing",
    items: [
      {
        question: "How does health testing work?",
        answer:
          "When a dog reaches breeding age, its owner can purchase health screening from the dog's profile. Results are available immediately and become part of the dog's public profile and pedigree information. Untested dogs show as not tested.",
      },
      {
        question: "Are health risks inherited?",
        answer:
          "Yes. Puppies inherit health tendencies from both parents, with natural variation. Close breeding can increase risk over time. Some screening outcomes, especially hip results, can also be influenced by environmental factors.",
      },
      {
        question: "Does a health result prevent breeding?",
        answer:
          "No. Health screening gives you information for breeding decisions, but it does not automatically prevent a dog from breeding. Choosing how to balance health, show quality, pedigree, and genetic diversity is part of managing your kennel.",
      },
      {
        question: "What do Hip Dysplasia screening results mean?",
        answer:
          "Hip results range from Excellent, Good, and Fair through Borderline, Mild, Moderate, and Severe. Excellent, Good, and Fair are the stronger results. Borderline deserves caution. Mild, Moderate, and Severe indicate increasing concern when planning a breeding.",
      },
      {
        question: "What do Cardiac screening results mean?",
        answer:
          "Normal is the strongest cardiac result. Equivocal means the screening result is uncertain or deserves caution. Abnormal indicates a cardiac concern that should be weighed carefully before breeding.",
      },
      {
        question: "What do CAER Eye screening results mean?",
        answer:
          "Normal is the strongest eye screening result. Breeder Option means a finding is present and the breeder must decide whether and how to use the dog. Not Cleared indicates a more serious eye concern.",
      },
      {
        question: "What do Thyroid screening results mean?",
        answer:
          "Normal is the strongest thyroid result. Equivocal means the result deserves caution. Autoimmune Thyroiditis and Reduced Thyroid Function indicate thyroid concerns that should be considered when planning a breeding.",
      },
      {
        question: "Are these DNA tests?",
        answer:
          "No. The current tests are phenotype screenings: they report the dog's health screening outcome. Future DNA marker tests will be separate and may report results such as clear, carrier, or affected for specific conditions.",
      },
    ],
  },
  {
    title: "Shows and Economy",
    items: [
      {
        question: "How do shows work?",
        answer:
          "Eligible dogs enter scheduled shows and are evaluated across categories such as type, structure, movement, coat, temperament, and conditioning.",
      },
      {
        question: "Can one dog dominate forever?",
        answer:
          "No. Aging, judge preferences, conditioning, breeding variation, and deeper competition all prevent permanent dominance.",
      },
      {
        question: "Are shows the best way to make money?",
        answer:
          "Shows are mainly about prestige, reputation, rankings, and proving breeding stock. Most kennel income comes from puppy sales, stud services, and dog sales.",
      },
      {
        question: "Why is money important?",
        answer:
          "Running a kennel costs money. Expenses can include show entries, travel, handlers, breeding, and kennel upkeep.",
      },
    ],
  },
  {
    title: "Kennel Prestige",
    items: [
      {
        question: "What is kennel prestige?",
        answer:
          "Kennel prestige is a career-style score that measures a kennel's long-term show and breeding impact. The same score and rank are used on private kennel pages, public kennel profiles, bulletin board rank labels, and kennel Top Ten standings.",
      },
      {
        question: "How are Breeding prestige points calculated?",
        answer:
          "A kennel earns 120 points for each champion it bred. It also earns 35 points for each unique champion-producing litter, meaning a litter with at least one kennel-bred CH. A litter counts once even if it produces multiple champions.",
      },
      {
        question: "How are Show prestige points calculated?",
        answer:
          "A kennel earns 90 points for each champion finished owner-handled and 65 points for each champion finished with a handler. Major awards also add prestige: BIS is worth 90, RBIS is worth 60, G1 is worth 35, and G2 through G4 are worth 12 each.",
      },
      {
        question: "How are Legacy prestige points calculated?",
        answer:
          "Legacy prestige uses current-year Top Ten standings. Breed Top Ten credits are worth 25 points when owned by the kennel and 35 points when bred by the kennel. All-breed Top Ten credits are worth 60 points when owned and 75 points when bred. A current #1 breed standing adds 50 points, and a current #1 all-breed standing adds 100 points.",
      },
      {
        question: "How are Care prestige points calculated?",
        answer:
          "Care prestige currently awards 30 points for each kennel-bred champion with all required phenotype health tests completed in the green range.",
      },
      {
        question: "What are the kennel prestige ranks?",
        answer:
          "Prestige ranks progress from New Kennel to Rising Kennel, Established Kennel, Respected Kennel, Premier Kennel, Elite Kennel, and Hallmark Kennel as the kennel's score grows.",
      },
    ],
  },
];

const beginnerTips = [
  "Start with a small number of dogs.",
  "Learn what judges reward.",
  "Pay attention to visible category strengths.",
  "Condition dogs regularly.",
  "Breed for balance, not perfection.",
  "Plan for future generations.",
];

export default function FAQPage() {
  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] px-6 py-6 shadow-[var(--dog-shadow)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--dog-label)]">
                Player Guide
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Frequently Asked Questions
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--dog-copy)] sm:text-base">
                A beginner-friendly guide to kennels, dog traits, breeding,
                shows, time, and the economy in ShowRing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-3 text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
              >
                Home
              </Link>
              <Link
                href="/market"
                className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                Browse Market
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-8 rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-panel)] p-6 shadow-[var(--dog-shadow)]">
          <h2 className="text-xl font-semibold text-white">
            Quick Beginner Tips
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {beginnerTips.map((tip) => (
              <div
                key={tip}
                className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3 text-sm leading-6 text-[var(--dog-copy)]"
              >
                {tip}
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6">
          {faqSections.map((section) => (
            <section
              key={section.title}
              id={
                section.title === "Health Testing"
                  ? "health-testing"
                  : section.title === "Kennel Prestige"
                    ? "kennel-prestige"
                    : undefined
              }
              className="rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-6 shadow-[var(--dog-shadow)]"
            >
              <h2 className="text-2xl font-semibold text-white">
                {section.title}
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {section.items.map((item) => (
                  <article
                    key={item.question}
                    className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4"
                  >
                    <h3 className="text-base font-semibold text-white">
                      {item.question}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--dog-copy)]">
                      {item.answer}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-6 text-sm leading-7 text-[var(--dog-copy)] shadow-[var(--dog-shadow)]">
          <h2 className="text-xl font-semibold text-white">Final Advice</h2>
          <p className="mt-3">
            No dog is perfect. No bloodline stays dominant forever. The best
            kennels are built through smart decisions, patience, careful
            evaluation, and long-term planning.
          </p>
        </section>
      </div>
    </main>
  );
}
