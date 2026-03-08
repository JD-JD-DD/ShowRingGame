"use client";

import { useMemo, useState } from "react";
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

function TraitList({ dog, title }: { dog: Dog; title: string }) {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        minWidth: "280px",
        textAlign: "left",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p><strong>Dog ID:</strong> {dog.dogId}</p>
      <p><strong>Reg Number:</strong> {dog.regNumber}</p>
      <p><strong>Sex:</strong> {dog.sex}</p>

      <h3 style={{ marginBottom: "8px" }}>Traits</h3>
      <ul style={{ marginTop: 0 }}>
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
    </div>
  );
}

export default function GenerateLitterPage() {
  const [sireId, setSireId] = useState(sampleSires[0]?.dogId ?? "");
  const [damId, setDamId] = useState(sampleDams[0]?.dogId ?? "");
  const [pupCount, setPupCount] = useState(6);
  const [result, setResult] = useState<LitterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSire = useMemo(
    () => sampleSires.find((dog) => dog.dogId === sireId) ?? null,
    [sireId]
  );

  const selectedDam = useMemo(
    () => sampleDams.find((dog) => dog.dogId === damId) ?? null,
    [damId]
  );

  function handleGenerateLitter() {
    setError(null);
    setResult(null);

    try {
      if (!selectedSire || !selectedDam) {
        throw new Error("Please select a valid sire and dam.");
      }

      if (!Number.isInteger(pupCount) || pupCount < 1 || pupCount > 12) {
        throw new Error("Puppy count must be between 1 and 12.");
      }

      const attempt = createBreedingAttempt({
        attemptId: generateId("ATTEMPT"),
        currentEpoch: currentEpochHour(),
        sire: selectedSire,
        dam: selectedDam,
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
        sireTraits: selectedSire.traits,
        damTraits: selectedDam.traits,
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

      {(selectedSire || selectedDam) && (
        <div
          style={{
            marginTop: "30px",
            display: "flex",
            gap: "20px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {selectedSire && <TraitList dog={selectedSire} title="Selected Sire" />}
          {selectedDam && <TraitList dog={selectedDam} title="Selected Dam" />}
        </div>
      )}

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
          marginTop: "30px",
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
          Select parents, review their traits, and generate a litter.
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: "40px",
            textAlign: "left",
            display: "inline-block",
            maxWidth: "900px",
            width: "100%",
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