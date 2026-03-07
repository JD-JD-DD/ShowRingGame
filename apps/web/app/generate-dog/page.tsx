"use client";

import { useState } from "react";
import { createFoundationDog, type Dog } from "@showring/rules";

function randomSex(): "M" | "F" {
  return Math.random() < 0.5 ? "M" : "F";
}

function randomBreedCode2(): string {
  return "WV";
}

function generateSerial7(): string {
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function generateRegNumber(breedCode2: string): string {
  const serial7 = generateSerial7();
  const litterOrder = "01";
  return `${breedCode2}${serial7}${litterOrder}`;
}

function generateDogId(): string {
  return `DOG-${crypto.randomUUID()}`;
}

function currentEpochHour(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

export default function GenerateDogPage() {
  const [dog, setDog] = useState<Dog | null>(null);

  function handleGenerateDog() {
    const breedCode2 = randomBreedCode2();

    const newDog = createFoundationDog({
      dogId: generateDogId(),
      regNumber: generateRegNumber(breedCode2),
      breedCode2,
      birthEpoch: currentEpochHour(),
      sex: randomSex(),
    });

    setDog(newDog);
  }

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>Generate Dog</h1>

      <button
        onClick={handleGenerateDog}
        style={{
          padding: "10px 16px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "24px",
        }}
      >
        Generate Dog
      </button>

      {!dog && <p>Dog output will appear here.</p>}

      {dog && (
        <div style={{ marginTop: "16px" }}>
          <p><strong>Dog ID:</strong> {dog.dogId}</p>
          <p><strong>Reg Number:</strong> {dog.regNumber}</p>
          <p><strong>Breed Code:</strong> {dog.breedCode2}</p>
          <p><strong>Sex:</strong> {dog.sex}</p>
          <p><strong>Status:</strong> {dog.status}</p>

          <h2 style={{ marginTop: "24px" }}>Hidden Traits</h2>
          <ul>
            <li>Head: {dog.traits.head}</li>
            <li>Forequarters: {dog.traits.forequarters}</li>
            <li>Hindquarters: {dog.traits.hindquarters}</li>
            <li>Gait: {dog.traits.gait}</li>
            <li>Coat: {dog.traits.coat}</li>
            <li>Size: {dog.traits.size}</li>
            <li>Temperament: {dog.traits.temperament}</li>
            <li>Show Shine: {dog.traits.show_shine}</li>
            <li>Feet: {dog.traits.feet}</li>
            <li>Topline: {dog.traits.topline}</li>
          </ul>

          <br />
          <a href="/">Back Home</a>
        </div>
      )}
    </main>
  );
}