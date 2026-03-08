"use client";

import { useState } from "react";
import {
  createBreedingAttempt,
  resolvePregnancyCheck,
  resolveWhelp,
  sampleSires,
  sampleDams,
  type Dog,
} from "@showring/rules";

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function random01(): number {
  return Math.random();
}

function randomSex(): "M" | "F" {
  return Math.random() < 0.5 ? "M" : "F";
}

function currentEpochHour(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

type LitterResult = {
  litter: {
    litterId: string;
    breedCode2: string;
    serial7: string;
    pupCount: number;
    sireId: string;
    damId: string;
    bornEpoch: number;
  };
  puppies: Dog[];
};

export default function GenerateLitterPage() {
  const [sireId, setSireId] = useState(sampleSires[0]?.dogId ?? "");
  const [damId, setDamId] = useState(sampleDams[0]?.dogId ?? "");
  const [pupCount, setPupCount] = useState(6);
  const [result, setResult] = useState<LitterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleGenerateLitter() {
    setError(null);
    setResult(null);

    try {
      const sire = sampleSires.find((dog) => dog.dogId === sireId);
      const dam = sampleDams.find((dog) => dog.dogId === damId);

      if (!sire || !dam) {
        throw new Error("Please select a valid sire and dam.");
      }

      if (!Number.isInteger(pupCount) || pupCount < 1 || pupCount > 12) {
        throw new Error("Puppy count must be between 1 and 12.");
      }

      const attempt = createBreedingAttempt({
        attemptId: generateId("ATTEMPT"),
        currentEpoch: currentEpochHour(),
        sire,
        dam,
        rngSeed: Math.floor(Math.random() * 1_000_000),
      });

      const checkedAttempt = resolvePregnancyCheck({
        attempt,
        currentEpoch: attempt.pregCheckEpoch,
        conceptionRate: 0.95,
        conceptionRoll: 0.01,
      });

      const puppySexes = Array.from({ length: pupCount }, () => randomSex());
      const puppyDogIds = Array.from({ length: pupCount }, () =>
        generateId("DOG")
      );

      const outcome = resolveWhelp({
        attempt: checkedAttempt,
        currentEpoch: checkedAttempt.dueEpoch,
        litterId: generateId("LITTER"),
        pupCount,
        puppySexes,
        puppyDogIds,
        sireTraits: sire.traits,
        damTraits: dam.traits,
        random01,
      });

      setResult({
        litter: outcome.litter,
        puppies: outcome.puppies,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    }
  }

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "sans-serif",
        textAlign: "center",
      }}
    >
      <h1>Generate Test Litter</h1>

      <div
        style={{
          marginTop: "30px",
          display: "inline-block",
          textAlign: "left",
          minWidth: "340px",
        }}
      >
        <label>
          <strong>Sire:</strong>
          <br />
          <select
            value={sireId}
            onChange={(e) => setSireId(e.target.value)}
            style={{
              marginTop: "6px",
              marginBottom: "16px",
              width: "100%",
              padding: "8px",
            }}
          >
            {sampleSires.map((dog) => (
              <option key={dog.dogId} value={dog.dogId}>
                {dog.regNumber} ({dog.dogId})
              </option>
            ))}
          </select>
        </label>

        <label>
          <strong>Dam:</strong>
          <br />
          <select
            value={damId}
            onChange={(e) => setDamId(e.target.value)}
            style={{
              marginTop: "6px",
              marginBottom: "16px",
              width: "100%",
              padding: "8px",
            }}
          >
            {sampleDams.map((dog) => (
              <option key={dog.dogId} value={dog.dogId}>
                {dog.regNumber} ({dog.dogId})
              </option>
            ))}
          </select>
        </label>

        <label>
          <strong>Puppy Count:</strong>
          <br />
          <input
            type="number"
            min={1}
            max={12}
            value={pupCount}
            onChange={(e) => setPupCount(Number(e.target.value))}
            style={{
              marginTop: "6px",
              marginBottom: "20px",
              width: "100%",
              padding: "8px",
            }}
          />
        </label>
      </div>

      <br />

      <button
        onClick={handleGenerateLitter}
        style={{
          padding: "14px 28px",
          fontSize: "18px",
          cursor: "pointer",
          borderRadius: "6px",
          border: "1px solid white",
          background: "black",
          color: "white",
          marginTop: "10px",
        }}
      >
        Generate Litter
      </button>

      {error && (
        <p style={{ color: "red", marginTop: "24px" }}>
          <strong>Error:</strong> {error}
        </p>
      )}

      {!error && !result && (
        <p style={{ marginTop: "30px" }}>
          Litter output will appear here.
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: "40px",
            textAlign: "left",
            display: "inline-block",
            maxWidth: "800px",
          }}
        >
          <h2>Litter Summary</h2>
          <p><strong>Litter ID:</strong> {result.litter.litterId}</p>
          <p><strong>Breed Code:</strong> {result.litter.breedCode2}</p>
          <p><strong>Serial7:</strong> {result.litter.serial7}</p>
          <p><strong>Pup Count:</strong> {result.litter.pupCount}</p>
          <p><strong>Sire ID:</strong> {result.litter.sireId}</p>
          <p><strong>Dam ID:</strong> {result.litter.damId}</p>

          <h2 style={{ marginTop: "30px" }}>Puppies</h2>

          {result.puppies.map((pup, index) => (
            <div
              key={pup.dogId}
              style={{
                border: "1px solid #ccc",
                padding: "16px",
                borderRadius: "8px",
                marginBottom: "16px",
              }}
            >
              <p><strong>Puppy #{index + 1}</strong></p>
              <p><strong>Dog ID:</strong> {pup.dogId}</p>
              <p><strong>Reg Number:</strong> {pup.regNumber}</p>
              <p><strong>Sex:</strong> {pup.sex}</p>
              <p><strong>Litter Order:</strong> {pup.litterOrder}</p>

              <h3>Traits</h3>
              <ul>
                <li>Head: {pup.traits.head}</li>
                <li>Forequarters: {pup.traits.forequarters}</li>
                <li>Hindquarters: {pup.traits.hindquarters}</li>
                <li>Gait: {pup.traits.gait}</li>
                <li>Coat: {pup.traits.coat}</li>
                <li>Size: {pup.traits.size}</li>
                <li>Temperament: {pup.traits.temperament}</li>
                <li>Show Shine: {pup.traits.show_shine}</li>
                <li>Feet: {pup.traits.feet}</li>
                <li>Topline: {pup.traits.topline}</li>
              </ul>
            </div>
          ))}

          <a href="/">Back Home</a>
        </div>
      )}
    </main>
  );
}