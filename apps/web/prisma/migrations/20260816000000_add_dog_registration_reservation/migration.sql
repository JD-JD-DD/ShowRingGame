CREATE TABLE "DogRegistrationReservation" (
    "regNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DogRegistrationReservation_pkey" PRIMARY KEY ("regNumber")
);

INSERT INTO "DogRegistrationReservation" ("regNumber")
SELECT "regNumber" FROM "Dog"
ON CONFLICT ("regNumber") DO NOTHING;

INSERT INTO "DogRegistrationReservation" ("regNumber")
SELECT l."breedCode2" || l."serial7" || LPAD(gs."litterOrder"::TEXT, 2, '0')
FROM "Litter" l
CROSS JOIN LATERAL generate_series(1, l."pupCount") AS gs("litterOrder")
ON CONFLICT ("regNumber") DO NOTHING;
