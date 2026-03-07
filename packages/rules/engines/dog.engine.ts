export type GeneratedDog = {
  breed: string
  sex: "M" | "F"
  traits: {
    head: number
    forequarters: number
    hindquarters: number
    gait: number
    coat: number
  }
}

function rand() {
  return Math.floor(Math.random() * 21)
}

export function generateTestDog(): GeneratedDog {
  return {
    breed: "Wirehaired Vizsla",
    sex: Math.random() < 0.5 ? "M" : "F",
    traits: {
      head: rand(),
      forequarters: rand(),
      hindquarters: rand(),
      gait: rand(),
      coat: rand(),
    }
  }
}