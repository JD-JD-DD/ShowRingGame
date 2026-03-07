"use client";

import { useState } from "react";

type TestDog = {
  breed: string;
  sex: "M" | "F";
  regNumber: string;
  traits: {
    head: number;
    forequarters: number;
    hindquarters: number;
    gait: number;
    coat: number;
    size: number;
    temperament: number;
    show_shine: number;
    feet: number;
    topline: number;
  };
};

function randTrait(): number {
  return Math.floor(Math.random() * 21);
}

function generateTestDog(): TestDog {
  const litterSerial = String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
  const litterOrder = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");

  return {
    breed: "Wirehaired Vizsla",
    sex: Math.random() < 0.5 ? "M" : "F",
    regNumber: `WV${litterSerial}${litterOrder}`,
    traits: {
      head: randTrait(),
      forequarters: randTrait(),
      hindquarters: randTrait(),
      gait: randTrait(),
      coat: randTrait(),
      size: randTrait(),
      temperament: randTrait(),
      show_shine: randTrait(),
      feet: randTrait(),
      topline: randTrait(),
    },
  };
}

export default function GenerateDogPage() {
  const [dog, setDog] = useState<TestDog | null>(null);

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>Generate Dog (Test)</h1>

      <button
        onClick={() => setDog(generateTestDog())}
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
          <p><strong>Breed:</strong> {dog.breed}</p>
          <p><strong>Sex:</strong> {dog.sex}</p>
          <p><strong>Reg Number:</strong> {dog.regNumber}</p>

          <h2 style={{ marginTop: "24px" }}>Traits</h2>
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