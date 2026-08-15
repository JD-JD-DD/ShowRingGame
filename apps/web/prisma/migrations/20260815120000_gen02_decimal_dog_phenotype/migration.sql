-- GEN-02: PostgreSQL converts each existing INTEGER exactly to NUMERIC(8,6).
-- No rows are inserted, deleted, recalculated, or otherwise rewritten.
ALTER TABLE "Dog"
  ALTER COLUMN "traitHead" TYPE DECIMAL(8, 6) USING "traitHead"::DECIMAL(8, 6),
  ALTER COLUMN "traitForequarters" TYPE DECIMAL(8, 6) USING "traitForequarters"::DECIMAL(8, 6),
  ALTER COLUMN "traitHindquarters" TYPE DECIMAL(8, 6) USING "traitHindquarters"::DECIMAL(8, 6),
  ALTER COLUMN "traitGait" TYPE DECIMAL(8, 6) USING "traitGait"::DECIMAL(8, 6),
  ALTER COLUMN "traitCoat" TYPE DECIMAL(8, 6) USING "traitCoat"::DECIMAL(8, 6),
  ALTER COLUMN "traitSize" TYPE DECIMAL(8, 6) USING "traitSize"::DECIMAL(8, 6),
  ALTER COLUMN "traitTemperament" TYPE DECIMAL(8, 6) USING "traitTemperament"::DECIMAL(8, 6),
  ALTER COLUMN "traitShowShine" TYPE DECIMAL(8, 6) USING "traitShowShine"::DECIMAL(8, 6),
  ALTER COLUMN "traitFeet" TYPE DECIMAL(8, 6) USING "traitFeet"::DECIMAL(8, 6),
  ALTER COLUMN "traitTopline" TYPE DECIMAL(8, 6) USING "traitTopline"::DECIMAL(8, 6);
