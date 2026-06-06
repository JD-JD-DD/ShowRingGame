const MAX_REGISTERED_NAME_LENGTH = 45;

const TITLE_ABBREVIATIONS = new Set(
  "CH GCH GCHB GCHG GCHP GCHS"
    .split(" ")
);

const DOG_ROLE_WORDS = new Set([
  "kennel",
  "kennels",
  "male",
  "stud",
  "sire",
  "bitch",
  "dam",
  "female",
]);

const TITLE_WORDS = new Set(["champion"]);

const BANNED_WORDS = new Set([
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cock",
  "cunt",
  "damn",
  "dick",
  "fuck",
  "motherfucker",
  "piss",
  "prick",
  "pussy",
  "shit",
  "slut",
  "twat",
  "whore",
]);

export type DogNameValidationResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeName(value: FormDataEntryValue | string | null): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function hasSeparatedTerm(name: string, term: string, flags = "i"): boolean {
  const pattern = new RegExp(`(^|[ '\\-])${escapeRegExp(term)}($|[ '\\-])`, flags);
  return pattern.test(name);
}

function containsBreedName(name: string, breedNames: string[]): boolean {
  const normalizedName = name.toLowerCase();

  return breedNames.some((breedName) => {
    const normalizedBreed = breedName.trim().toLowerCase();
    if (!normalizedBreed) return false;

    return hasSeparatedTerm(normalizedName, normalizedBreed, "");
  });
}

export function validateRegisteredDogName(
  value: FormDataEntryValue | string | null,
  breedNames: string[]
): DogNameValidationResult {
  const name = normalizeName(value);

  if (name.length < 1) {
    return { ok: false, error: "Dog name is required." };
  }

  if (name.length > MAX_REGISTERED_NAME_LENGTH) {
    return {
      ok: false,
      error: `Dog name must be ${MAX_REGISTERED_NAME_LENGTH} characters or fewer.`,
    };
  }

  if (!/^[A-Za-z][A-Za-z '\-]*$/.test(name)) {
    return {
      ok: false,
      error:
        "Dog names may only use standard English letters, spaces, hyphens, and apostrophes.",
    };
  }

  for (const title of TITLE_ABBREVIATIONS) {
    if (hasSeparatedTerm(name.toUpperCase(), title, "")) {
      return { ok: false, error: "Dog names cannot include title abbreviations." };
    }
  }

  for (const titleWord of TITLE_WORDS) {
    if (hasSeparatedTerm(name, titleWord)) {
      return { ok: false, error: "Dog names cannot include show title terms." };
    }
  }

  for (const roleWord of DOG_ROLE_WORDS) {
    if (hasSeparatedTerm(name, roleWord)) {
      return { ok: false, error: "Dog names cannot include dog-role words." };
    }
  }

  for (const bannedWord of BANNED_WORDS) {
    if (hasSeparatedTerm(name, bannedWord)) {
      return { ok: false, error: "Dog name is not allowed." };
    }
  }

  if (containsBreedName(name, breedNames)) {
    return { ok: false, error: "Dog names cannot include breed names." };
  }

  return { ok: true, name };
}
