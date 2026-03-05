// visible registration number

// registration format
// <BreedCode><Serial7><LitterOrder2>
// Example: SS123456702

// <breed code>
// exactly two uppercase letters and unique
export const BREED_CODE2_LENGTH = 2
export const BREED_CODE2_REGEX = /^[A-Z]{2}$/

// <serial7>
export const LITTER_SERIAL_LENGTH = 7

// <litterorder>
export const LITTER_ORDER_PAD = 2