const MAX_REGISTERED_NAME_LENGTH = 45;

const TITLE_ABBREVIATIONS = new Set(
  "ACT1 ACT1J ACT2 ACT2J AE AEA AEX AFC AGCH AJ AJA AJP AJX AM AMA AMX AN ANA ANX AS ASA ASX ATT AX BCAT BDD BH BN BN-V CA CAA CAX CC CCA CCH CD CD-V CDX CFC CGC CGCA CGCH CGCU CGF CGN CGW CH CI CIT CJN CM CNC CRCG CS CSG CSGF CSGN CSGW CST CT CWC CWGN CWSG CX CXT DC DCAT DD DE DEA DEX DJ DJA DJX DM DMA DMX DN DNA DNX DS DSA DSX EE FC FCAT FCB FCGD FCLP FDC FDCH FDGCH FH1 FH2 FITB FITG FITS FM FTA FTI FTN FTR GAFC GCH GCHB GCHG GCHP GCHS GFC GN GO HC HI HIAC HIACM HIAD HIADM HIAS HIASM HIBC HIBD HIBDM HIBS HIBSM HICS HICSM HS HSAC HSACM HSAD HSADM HSAS HSASM HSBC HSBD HSBDM HSBS HSBSM HSCS HSCSM HT HX HXAC HXACM HXAD HXADM HXAS HXASM HXBC HXBD HXBDM HXBS HXBSM HXCS HXCSM IPO1 IPO2 IPO3 JC JE JH JHA JHR JHU JHUA LCX MACH MC ME MFB MFC MFG MFP MFPB MFPC MFPG MFPS MFS MH MHA MHR MHU MHUA MJB MJC MJG MJP MJPB MJPC MJPG MJPS MJS MNH MT MTI MTX MX MXB MXC MXF MXG MXJ MXP MXPB MXPC MXPG MXPS MXS NA NAC NAFC NAGDC NAJ NAP NBC NBDD NDD NE NF NFC NFP NGBC NGDC NJP NLPC NOC NSPC NTCPC NWGDC OA OAJ OAP OF OFP OGM OJP OM ONYX OTCH PACH PAD PADP PAX PCD PCDX PCJH PCMH PCSH PDB PDBP PDC PDCP PDG PDGP PDS PDSP PJB PJBP PJC PJCP PJD PJDP PJG PJGP PJS PJSP PNAC POC PT PUDX PUTD QA2 RA RACH RAE RATCH RATCHX RATM RATN RATO RATS RC RD RDX RE RI RM RN RNC SAR-U1 SAR-U2 SAR-U3 SAR-W SBA SBAE SBE SBEE SBM SBME SBN SBNE SC SCA SCAE SCE SCEE SCHH1 SCHH2 SCHH3 SCHHA SCM SCME SCN SCNE SD SDO SDX SE SEA SEAE SEE SEEE SEM SEME SEN SENE SH SHA SHDA SHDAE SHDE SHDEE SHDM SHDME SHDN SHDNE SHR SHU SHUA SIA SIAE SIE SIEE SIM SIME SIN SINE STR SWA SWAE SWD SWE SWEE SWM SWME SWN SWNE T2B T2BP TC TD TDD TDU TDX THD THDA THDD THDN THDS THDX TKA TKE TKI TKN TKP TQX TQXP TT UD UDX VCCH VCD VER VST VSWB VSWE VSWI WC WCI WCX WDS1 WDS2 WDS3 WNC XF XFP"
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

const TITLE_WORDS = new Set(["champion", "champ", "sieger", "win", "winner"]);

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
