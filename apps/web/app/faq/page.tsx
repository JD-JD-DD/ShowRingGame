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
        <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
                Player Guide
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Frequently Asked Questions
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75 sm:text-base">
                A beginner-friendly guide to kennels, dog traits, breeding,
                shows, time, and the economy in ShowRing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
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

        <section className="mb-8 rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(255,255,255,0.04))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <h2 className="text-xl font-semibold text-white">
            Quick Beginner Tips
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {beginnerTips.map((tip) => (
              <div
                key={tip}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-purple-100/78"
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
              className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            >
              <h2 className="text-2xl font-semibold text-white">
                {section.title}
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {section.items.map((item) => (
                  <article
                    key={item.question}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <h3 className="text-base font-semibold text-white">
                      {item.question}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-purple-100/74">
                      {item.answer}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-[28px] border border-purple-300/15 bg-white/5 p-6 text-sm leading-7 text-purple-100/76 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
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
