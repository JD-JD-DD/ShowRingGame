export type PrototypeVisibleCategory = {
  key: string;
  label: string;
  value: number;
  min: number;
  ideal: number;
  max: number;
  leftLabel: string;
  centerLabel: string;
  rightLabel: string;
};

// Static presentation-only data. This intentionally carries forward the Start Up
// Guide's player-facing Aster identity without importing its fixture or services.
export const prototypeDog = {
  registeredName: "Demo's Ringbright Aster",
  callName: "Aster",
  titlePrefix: "CH",
  breed: "Dachshund",
  sex: "Female",
  age: "2y 4w",
  registrationNumber: "DT713761101",
  owner: "Demo Kennel",
  breeder: "Foundation",
  kennelRun: "Main Show Team",
  lifecycle: "Alive · Open · Eligible",
  healthSummary: "4 of 4 health tests complete",
  healthResults: [
    ["Hip evaluation", "Good", "Year 3, Week 1", "green"],
    ["Eye exam", "Normal", "Year 3, Week 1", "green"],
    ["Cardiac screening", "Normal", "Year 3, Week 1", "green"],
    ["Brucellosis screening", "Current negative", "Valid through Year 3, Week 6", "green"],
  ] as const,
  visibleCategories: [
    { key: "type", label: "Type & Expression", value: 11.2, min: 0, ideal: 10, max: 20, leftLabel: "Under ideal", centerLabel: "10 ideal", rightLabel: "Over ideal" },
    { key: "structure", label: "Structure & Balance", value: 9.4, min: 0, ideal: 10, max: 20, leftLabel: "Under ideal", centerLabel: "10 ideal", rightLabel: "Over ideal" },
    { key: "movement", label: "Movement", value: 12.1, min: 0, ideal: 10, max: 20, leftLabel: "Under ideal", centerLabel: "10 ideal", rightLabel: "Over ideal" },
    { key: "coat", label: "Coat & Presentation", value: 8.8, min: 0, ideal: 10, max: 20, leftLabel: "Under ideal", centerLabel: "10 ideal", rightLabel: "Over ideal" },
    { key: "temperament", label: "Temperament", value: 10.6, min: 0, ideal: 10, max: 20, leftLabel: "Under ideal", centerLabel: "10 ideal", rightLabel: "Over ideal" },
    { key: "conditioning", label: "Conditioning & Handling", value: 8.1, min: 0, ideal: 10, max: 10, leftLabel: "0", centerLabel: "", rightLabel: "10 optimized" },
  ] satisfies PrototypeVisibleCategory[],
  showCareer: [
    ["Champion", "16 points · 2 majors", "Completed"],
    ["Grand Champion", "8 / 25 points · 1 / 3 majors", "In progress"],
    ["Latest result", "Best of Breed · Group 2", "Copper Valley Kennel Club"],
  ] as const,
  pedigree: [
    ["Sire", "Foundation Sire", "Health cleared"],
    ["Dam", "Foundation Dam", "4 of 5 tests complete"],
    ["COI", "0.00%", "Four generations recorded"],
  ] as const,
  production: [
    ["Program role", "Brood bitch"],
    ["Latest litter", "4 puppies · 4 survived"],
    ["Producer merit", "0 of 3 champion offspring"],
  ] as const,
} as const;

export const prototypeCurrentShowEntries = [
  { id: "copper-valley-day-1", showName: "Copper Valley Kennel Club", showDateLabel: "Year 3, Week 4 · 10:00", dayLabel: "Day 1", district: "Mountain District" },
  { id: "copper-valley-day-2", showName: "Copper Valley Kennel Club", showDateLabel: "Year 3, Week 4 · 10:00", dayLabel: "Day 2", district: "Mountain District" },
  { id: "northstar-specialty", showName: "Northstar Hound & Scent Specialty", showDateLabel: "Year 3, Week 5 · 09:30", dayLabel: "Day 1", district: "Lakes District" },
] as const;
